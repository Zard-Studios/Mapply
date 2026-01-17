/**
 * aiAdapter.js – AI Integration Placeholder
 * 
 * This file prepares the infrastructure for future AI integration.
 * Currently disabled – all functions return errors or mock data.
 * 
 * =====================================================
 * AI CONFIGURATION (TODO: Add your API key here)
 * =====================================================
 * 
 * const API_KEY = 'your-api-key-here';
 * const API_URL = 'https://api.openai.com/v1/chat/completions';
 * 
 * Supported providers:
 * - OpenAI (GPT-4, GPT-3.5)
 * - Anthropic (Claude)
 * - Google (Gemini)
 * - Local (Ollama)
 */

// Configuration (disabled by default)
const AI_CONFIG = {
    enabled: false,
    apiKey: null,
    apiUrl: null,
    model: null
};

/**
 * Check if AI is configured and enabled
 * @returns {boolean}
 */
export function isAIEnabled() {
    return AI_CONFIG.enabled && AI_CONFIG.apiKey && AI_CONFIG.apiUrl;
}

/**
 * Generate a concept map from text input
 * 
 * RULES FOR AI OUTPUT:
 * - Maximum 3-5 nodes
 * - Extremely short phrases (max 50 characters per node)
 * - Simple language (middle/high school level)
 * - Return ONLY valid JSON matching the schema
 * - Any extra text is an error
 * 
 * @param {string} text - Input text to generate map from
 * @returns {Promise<Object>} Map data matching schema.js format
 * @throws {Error} If AI is not configured
 */
export async function generateMapFromText(text) {
    if (!isAIEnabled()) {
        throw new Error('AI non configurata. Aggiungi la tua API key in aiAdapter.js');
    }

    // Validate input
    if (!text || text.trim().length < 10) {
        throw new Error('Inserisci almeno 10 caratteri per generare una mappa');
    }

    // System prompt for the AI (Italian, DSA-friendly)
    const systemPrompt = `Sei un assistente per studenti con DSA.
Crea mappe concettuali SEMPLICISSIME.

REGOLE RIGIDE:
1. Massimo 5 nodi totali
2. 1 nodo principale + max 4 secondari
3. Frasi BREVISSIME (max 50 caratteri)
4. Linguaggio semplice (livello scuola media)
5. Rispondi SOLO con JSON valido, niente altro testo

FORMATO JSON (rispetta esattamente):
{
  "title": "Titolo breve",
  "nodes": [
    {
      "type": "main",
      "title": "Concetto principale",
      "text": "Breve spiegazione",
      "color": "purple"
    },
    {
      "type": "secondary", 
      "title": "Sotto-concetto",
      "text": "Dettaglio breve",
      "color": "blue"
    }
  ]
}

Colori disponibili: purple, blue, green, orange, pink`;

    // User prompt
    const userPrompt = `Crea una mappa concettuale per: ${text.trim()}`;

    try {
        // TODO: Implement actual API call
        // const response = await fetch(AI_CONFIG.apiUrl, {
        //   method: 'POST',
        //   headers: {
        //     'Authorization': `Bearer ${AI_CONFIG.apiKey}`,
        //     'Content-Type': 'application/json'
        //   },
        //   body: JSON.stringify({
        //     model: AI_CONFIG.model,
        //     messages: [
        //       { role: 'system', content: systemPrompt },
        //       { role: 'user', content: userPrompt }
        //     ],
        //     temperature: 0.7,
        //     max_tokens: 500
        //   })
        // });
        // 
        // const data = await response.json();
        // const content = data.choices[0].message.content;
        // return parseAIResponse(content);

        throw new Error('AI non configurata. Aggiungi la tua API key in aiAdapter.js');

    } catch (error) {
        console.error('AI Generation Error:', error);
        throw error;
    }
}

/**
 * Parse and validate AI response
 * @param {string} content - Raw AI response
 * @returns {Object} Validated map data
 */
function parseAIResponse(content) {
    // Try to extract JSON from response
    let jsonString = content.trim();

    // Handle markdown code blocks
    if (jsonString.startsWith('```')) {
        jsonString = jsonString.replace(/```json?\n?/g, '').replace(/```$/g, '');
    }

    try {
        const data = JSON.parse(jsonString);

        // Validate structure
        if (!data.title || !Array.isArray(data.nodes)) {
            throw new Error('Formato risposta AI non valido');
        }

        // Ensure we have a main node
        const hasMain = data.nodes.some(n => n.type === 'main');
        if (!hasMain && data.nodes.length > 0) {
            data.nodes[0].type = 'main';
        }

        // Limit nodes
        if (data.nodes.length > 5) {
            data.nodes = data.nodes.slice(0, 5);
        }

        return data;

    } catch (e) {
        throw new Error('Errore nel parsing della risposta AI');
    }
}

/**
 * Configure the AI adapter
 * @param {Object} config - { apiKey, apiUrl, model }
 */
export function configureAI(config) {
    if (config.apiKey) AI_CONFIG.apiKey = config.apiKey;
    if (config.apiUrl) AI_CONFIG.apiUrl = config.apiUrl;
    if (config.model) AI_CONFIG.model = config.model;
    AI_CONFIG.enabled = !!(AI_CONFIG.apiKey && AI_CONFIG.apiUrl);
}
