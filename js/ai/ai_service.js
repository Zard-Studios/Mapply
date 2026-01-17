
/**
 * AI Service - Handles communication with OpenRouter (OpenAI compatible API)
 */

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

export class AIService {
    constructor() {
        this.apiKey = localStorage.getItem('mapply_openrouter_key') || '';
        this.model = localStorage.getItem('mapply_ai_model') || 'google/gemini-flash-1.5';
        this.systemPrompt = `
Sei Mapply AI, assistente per Mappe Concettuali per studenti DSA.

STRUTTURA delle mappe:
- Nodo MAIN (type: "main"): Argomento centrale, font grande, bold
- Nodi SECONDARY (type: "secondary"): Macro-argomenti principali
- Nodi CHILD (type: "child"): Dettagli e descrizioni

FORMATTAZIONE del contenuto:
- Usa **bold** per termini importanti
- Usa *italic* per descrizioni/spiegazioni
- Il contenuto può includere descrizioni complete, non solo parole chiave

LAYOUT:
- Il nodo main va in alto
- I secondary si diramano orizzontalmente sotto il main
- I child vanno sotto i secondary come descrizioni

Genera JSON con questa struttura:
\`\`\`json
{
  "nodes": [
    { "id": "n1", "content": "**Argomento Principale**", "type": "main" },
    { "id": "n2", "content": "Macro Argomento 1", "type": "secondary" },
    { "id": "n3", "content": "*Descrizione del macro argomento*", "type": "child" },
    { "id": "n4", "content": "Macro Argomento 2", "type": "secondary" },
    { "id": "n5", "content": "*Altra descrizione dettagliata*", "type": "child" }
  ],
  "connections": [
    { "from": "n1", "to": "n2" },
    { "from": "n2", "to": "n3" },
    { "from": "n1", "to": "n4" },
    { "from": "n4", "to": "n5" }
  ]
}
\`\`\`

IMPORTANTE: Le connessioni devono seguire la gerarchia (main -> secondary -> child).
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
