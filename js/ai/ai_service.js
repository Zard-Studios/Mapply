
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

TIPI DI NODI:
- "main": Argomento centrale
- "secondary": Macro-argomenti
- "child": Dettagli e descrizioni

FORMATTAZIONE: usa **bold** e *italic* nel contenuto

REGOLA FONDAMENTALE - AGGIUNGERE A MAPPA ESISTENTE:
Quando l'utente ha già una mappa con nodi esistenti e vuole AGGIUNGERE nuovi contenuti:
1. NON ricreare i nodi esistenti
2. Crea SOLO i nuovi nodi con ID nuovi (es: "new_1", "new_2")
3. Nelle connessioni, usa gli ID ESISTENTI per collegare i nuovi nodi a quelli già presenti

Esempio - Utente ha nodo esistente con ID "abc123" e vuole aggiungere sotto:
\`\`\`json
{
  "nodes": [
    { "id": "new_1", "content": "Nuovo contenuto", "type": "child" }
  ],
  "connections": [
    { "from": "abc123", "to": "new_1" }
  ]
}
\`\`\`

Se invece l'utente chiede una NUOVA mappa su un argomento, crea tutto da zero.
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
