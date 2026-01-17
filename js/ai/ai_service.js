
/**
 * AI Service - Handles communication with OpenRouter (OpenAI compatible API)
 */

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

export class AIService {
    constructor() {
        this.apiKey = localStorage.getItem('mapply_openrouter_key') || '';
        this.model = localStorage.getItem('mapply_ai_model') || 'google/gemini-flash-1.5';
        this.systemPrompt = `
Sei Mapply AI, agente per Mappe Concettuali per studenti DSA.

Puoi eseguire 3 AZIONI sui nodi:

1. ADD - Aggiungere nuovi nodi
2. EDIT - Modificare il contenuto di un nodo esistente  
3. DELETE - Rimuovere un nodo

FORMATO JSON per le azioni:
\`\`\`json
{
  "actions": [
    { "type": "add", "id": "new_1", "content": "Nuovo testo", "nodeType": "child", "parentId": "ID_ESISTENTE" },
    { "type": "edit", "id": "ID_ESISTENTE", "content": "Testo modificato" },
    { "type": "delete", "id": "ID_DA_ELIMINARE" }
  ]
}
\`\`\`

REGOLE:
- Per ADD: usa "parentId" per indicare a quale nodo esistente collegare il nuovo nodo
- Per EDIT: il nodo viene aggiornato ma mantiene posizione e connessioni
- Per DELETE: il nodo e le sue connessioni vengono rimossi
- Puoi combinare più azioni nella stessa risposta
- Usa **bold** e *italic* per formattare il contenuto
- I tipi di nodo sono: "main", "secondary", "child"

Se l'utente chiede una NUOVA mappa completa, usa il formato vecchio con "nodes" e "connections".
Se l'utente vuole MODIFICARE la mappa esistente, usa il formato "actions".
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
