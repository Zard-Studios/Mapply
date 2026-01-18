
/**
 * AI Service - Handles communication with OpenRouter (OpenAI compatible API)
 */

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

export class AIService {
    constructor() {
        this.apiKey = localStorage.getItem('mapply_openrouter_key') || '';
        this.model = localStorage.getItem('mapply_ai_model') || 'google/gemini-flash-1.5';
        this.systemPrompt = `
Sei Mapply AI, un agente INTELLIGENTE per Mappe Concettuali.

AZIONI DISPONIBILI:

1. ADD - Aggiunge nodo: { "type": "add", "content": "...", "nodeType": "main|secondary|child", "parentId": "ID" }
2. EDIT - Modifica testo: { "type": "edit", "id": "ID", "content": "nuovo testo" }
3. DELETE - Rimuove nodo: { "type": "delete", "id": "ID" }
4. CONNECT - Collega nodi: { "type": "connect", "from": "ID_PARENT", "to": "ID_CHILD" }
5. DISCONNECT - Scollega: { "type": "disconnect", "from": "ID", "to": "ID" }
6. MOVE - Sposta nodo: { "type": "move", "id": "ID", "x": 100, "y": 200 }
7. REORGANIZE - Riorganizza TUTTO intelligentemente (analizza contenuti, ricrea connessioni logiche, riposiziona)

QUANDO L'UTENTE CHIEDE DI ORDINARE/ORGANIZZARE:
Rispondi con:
\`\`\`json
{
  "actions": [{ "type": "reorganize" }]
}
\`\`\`

COSA FA REORGANIZE:
1. Analizza il CONTENUTO di ogni nodo
2. Identifica il nodo PRINCIPALE (argomento centrale)
3. Determina quali nodi sono SOTTO-ARGOMENTI del principale
4. Determina quali nodi sono DETTAGLI dei sotto-argomenti
5. ELIMINA tutte le connessioni errate
6. CREA le connessioni CORRETTE basate sul significato
7. POSIZIONA i nodi in gerarchia pulita

FORMATO RISPOSTA REORGANIZE:
\`\`\`json
{
  "actions": [{
    "type": "reorganize",
    "structure": {
      "mainId": "ID_NODO_PRINCIPALE",
      "hierarchy": [
        { "parentId": "ID_MAIN", "childIds": ["ID1", "ID2", "ID3"] },
        { "parentId": "ID1", "childIds": ["ID4", "ID5"] }
      ]
    }
  }]
}
\`\`\`

REGOLE:
- Usa **bold** e *italic* per formattare
- Per nuove mappe usa "nodes" e "connections"
- Per modifiche usa "actions"
- REORGANIZE richiede di analizzare il SIGNIFICATO dei contenuti
        `.trim();
    }

    setApiKey(key) {
        this.apiKey = key;
        localStorage.setItem('mapply_openrouter_key', key);
    }

    setModel(model) {
        this.model = model;
        localStorage.setItem('mapply_ai_model', model);
    }

    getApiKey() {
        return this.apiKey;
    }

    getModel() {
        return this.model;
    }

    async generateCompletion(messages, onStreamChunk = null) {
        if (!this.apiKey) {
            throw new Error('API Key missing. Please configure it in Settings.');
        }

        const headers = {
            'Authorization': `Bearer ${this.apiKey}`,
            'HTTP-Referer': window.location.origin, // Required by OpenRouter
            'X-Title': 'Mapply',
            'Content-Type': 'application/json'
        };

        const body = {
            model: this.model,
            messages: [
                { role: 'system', content: this.systemPrompt },
                ...messages
            ],
            stream: !!onStreamChunk // Enable streaming if callback provided
        };

        try {
            const response = await fetch(OPENROUTER_API_URL, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error?.message || 'AI Request failed');
            }

            if (onStreamChunk) {
                // Handle Stream
                const reader = response.body.getReader();
                const decoder = new TextDecoder("utf-8");

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    const chunk = decoder.decode(value);
                    const lines = chunk.split('\n');

                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            const data = line.slice(6);
                            if (data === '[DONE]') break;
                            try {
                                const parsed = JSON.parse(data);
                                const content = parsed.choices[0]?.delta?.content || '';
                                if (content) onStreamChunk(content);
                            } catch (e) {
                                // console.warn('Stream parse error', e);
                            }
                        }
                    }
                }
                return; // Stream handled
            } else {
                // Normal Response
                const data = await response.json();
                return data.choices[0].message.content;
            }

        } catch (error) {
            console.error('AI Error:', error);
            throw error;
        }
    }
}

export const aiService = new AIService();
