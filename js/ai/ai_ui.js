
/**
 * AI UI Controller - Handles Sidebar, Settings Modal, and Chat Interaction
 */
import { aiService } from './ai_service.js';

export function initAIUI() {
    setupSettingsModal();
    setupAIPanel();
}

function setupSettingsModal() {
    const modal = document.getElementById('settings-modal');
    const btnSettings = document.getElementById('btn-settings');
    const btnClose = modal.querySelector('.btn-close');
    const btnSave = document.getElementById('btn-save-settings');
    const inputKey = document.getElementById('ai-api-key');
    const selectModel = document.getElementById('ai-model');
    const btnToggleVis = document.getElementById('btn-toggle-visibility');

    // Load saved values
    inputKey.value = aiService.getApiKey();

    // Fetch models from OpenRouter
    fetchAndPopulateModels(selectModel, aiService.getModel());

    // Toggle Modal
    btnSettings.addEventListener('click', () => {
        modal.classList.add('visible');
    });

    const closeModal = () => {
        modal.classList.remove('visible');
    };

    btnClose.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    // Toggle Password Visibility
    btnToggleVis.addEventListener('click', () => {
        inputKey.type = inputKey.type === 'password' ? 'text' : 'password';
    });

    // Save
    btnSave.addEventListener('click', () => {
        const key = inputKey.value.trim();
        const model = selectModel.value;

        if (key) {
            aiService.setApiKey(key);
            aiService.setModel(model);
            closeModal();
            import('../ui.js').then(({ showToast }) => showToast('Impostazioni AI Salvate', 'success'));
        } else {
            import('../ui.js').then(({ showToast }) => showToast('Inserisci una API Key valida', 'error'));
        }
    });
}

function setupAIPanel() {
    const panel = document.getElementById('ai-panel');
    const btnToggle = document.getElementById('btn-ai-toggle');
    const btnClose = document.getElementById('btn-close-ai');
    const btnSend = document.getElementById('btn-send-ai');
    const inputPrompt = document.getElementById('ai-prompt');
    const messagesContainer = document.getElementById('ai-messages');

    // Toggle Panel
    btnToggle.addEventListener('click', () => {
        panel.classList.toggle('visible');
        if (panel.classList.contains('visible')) {
            setTimeout(() => inputPrompt.focus(), 100);
        }
    });

    btnClose.addEventListener('click', () => {
        panel.classList.remove('visible');
    });

    // Auto-resize textarea
    inputPrompt.addEventListener('input', function () {
        this.style.height = 'auto';
        this.style.height = (this.scrollHeight) + 'px';
    });

    // Send Message
    const sendMessage = async () => {
        const text = inputPrompt.value.trim();
        if (!text) return;

        // Add User Message
        appendMessage('user', text);
        inputPrompt.value = '';
        inputPrompt.style.height = 'auto';

        // Placeholder for AI thinking
        const loadingId = appendMessage('system', 'Sto pensando...', true);

        try {
            // Call AI Service
            const response = await aiService.generateCompletion([
                { role: 'user', content: text }
            ]);

            // Try to parse JSON from response
            const mapData = extractMapJSON(response);

            if (mapData && mapData.nodes && mapData.nodes.length > 0) {
                // Create nodes on the canvas!
                const result = await createMapFromAI(mapData);
                updateMessage(loadingId, `✨ Ho creato ${result.nodesCreated} nodi sulla mappa!`);
            } else {
                // No JSON found, just show the text response
                updateMessage(loadingId, response);
            }

        } catch (error) {
            updateMessage(loadingId, `Errore: ${error.message}`, true);
        }
    };

    btnSend.addEventListener('click', sendMessage);
    inputPrompt.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
}

// UI Helpers
function appendMessage(role, text, isLoading = false) {
    const container = document.getElementById('ai-messages');
    const msg = document.createElement('div');
    msg.className = `ai-message ${role} ${isLoading ? 'loading' : ''}`;
    if (isLoading) msg.id = `msg-${Date.now()}`;
    msg.innerHTML = formatText(text); // Basic formatting
    container.appendChild(msg);
    container.scrollTop = container.scrollHeight;
    return msg.id;
}

function updateMessage(id, text, isError = false) {
    const msg = document.getElementById(id);
    if (msg) {
        msg.classList.remove('loading');
        if (isError) msg.classList.add('error');
        msg.innerHTML = formatText(text);
        const container = document.getElementById('ai-messages'); // ensure scroll
        container.scrollTop = container.scrollHeight;
    }
}

function formatText(text) {
    // Basic newline to br
    return text.replace(/\n/g, '<br>');
}

/**
 * Fetch all available models from OpenRouter and populate the select dropdown
 */
async function fetchAndPopulateModels(selectElement, currentModel) {
    // Show loading state
    selectElement.innerHTML = '<option value="">Caricamento modelli...</option>';

    try {
        const response = await fetch('https://openrouter.ai/api/v1/models');
        if (!response.ok) throw new Error('Failed to fetch models');

        const data = await response.json();
        const models = data.data || [];

        // Sort by name
        models.sort((a, b) => a.name.localeCompare(b.name));

        // Clear and populate
        selectElement.innerHTML = '';

        // Group by provider (first part of id before /)
        const grouped = {};
        models.forEach(model => {
            const provider = model.id.split('/')[0];
            if (!grouped[provider]) grouped[provider] = [];
            grouped[provider].push(model);
        });

        // Create optgroups
        Object.keys(grouped).sort().forEach(provider => {
            const optgroup = document.createElement('optgroup');
            optgroup.label = provider.charAt(0).toUpperCase() + provider.slice(1);

            grouped[provider].forEach(model => {
                const option = document.createElement('option');
                option.value = model.id;
                // Format: Name (Context Length) - Pricing indicator
                const contextK = model.context_length ? Math.round(model.context_length / 1000) + 'k' : '';
                const pricing = model.pricing?.prompt === '0' ? '🆓' : '';
                option.textContent = `${model.name} ${contextK ? `(${contextK})` : ''} ${pricing}`.trim();
                optgroup.appendChild(option);
            });

            selectElement.appendChild(optgroup);
        });

        // Set current value
        if (currentModel) {
            selectElement.value = currentModel;
        }

    } catch (error) {
        console.error('Failed to load models:', error);
        // Fallback to static list
        selectElement.innerHTML = `
            <option value="google/gemini-flash-1.5">Gemini Flash 1.5</option>
            <option value="openai/gpt-4o">GPT-4o</option>
            <option value="anthropic/claude-3.5-sonnet">Claude 3.5 Sonnet</option>
            <option value="meta-llama/llama-3-8b-instruct">Llama 3 8B</option>
        `;
        if (currentModel) selectElement.value = currentModel;
    }
}

/**
 * Extract JSON map data from AI response text
 * Looks for ```json ... ``` blocks or raw JSON objects
 */
function extractMapJSON(text) {
    // Try to find JSON in code block
    const codeBlockMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
    if (codeBlockMatch) {
        try {
            return JSON.parse(codeBlockMatch[1]);
        } catch (e) {
            console.warn('Failed to parse JSON from code block:', e);
        }
    }

    // Try to find raw JSON object
    const jsonMatch = text.match(/\{[\s\S]*"nodes"[\s\S]*\}/);
    if (jsonMatch) {
        try {
            return JSON.parse(jsonMatch[0]);
        } catch (e) {
            console.warn('Failed to parse raw JSON:', e);
        }
    }

    return null;
}

/**
 * Create nodes and connections on the canvas from AI-generated data
 */
async function createMapFromAI(mapData) {
    const { createNode, createConnection } = await import('../schema.js');
    const nodesModule = await import('../nodes.js');

    const idMapping = new Map(); // AI ID -> Real ID
    let nodesCreated = 0;

    // Calculate starting position (center of viewport, then spread out)
    const canvas = document.getElementById('viewport');
    const rect = canvas?.getBoundingClientRect() || { width: 800, height: 600 };
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    // Layout nodes in a radial pattern from center
    const totalNodes = mapData.nodes.length;
    const mainNode = mapData.nodes.find(n => n.type === 'main');
    const childNodes = mapData.nodes.filter(n => n.type !== 'main');

    // Create main node at center
    if (mainNode) {
        const newNode = createNode({
            content: mainNode.content,
            type: 'main',
            x: centerX - 80,
            y: centerY - 40
        });
        idMapping.set(mainNode.id, newNode.id);
        nodesModule.addNodeToMap(newNode);
        nodesCreated++;
    }

    // Create child nodes in concentric rings
    // Calculate how many nodes per ring (more space = better readability)
    const nodeWidth = 180; // Approximate node width with padding
    const nodeHeight = 80;
    const baseRadius = 250;
    const ringSpacing = 180;
    const nodesPerRing = 8; // Max nodes per ring for good spacing

    childNodes.forEach((node, i) => {
        // Determine which ring this node belongs to
        const ring = Math.floor(i / nodesPerRing);
        const posInRing = i % nodesPerRing;
        const nodesInThisRing = Math.min(nodesPerRing, childNodes.length - ring * nodesPerRing);

        const radius = baseRadius + ring * ringSpacing;
        const angle = (posInRing / nodesInThisRing) * 2 * Math.PI - Math.PI / 2;

        // Add slight offset for each ring to prevent alignment
        const angleOffset = ring * 0.2;

        const x = centerX + radius * Math.cos(angle + angleOffset) - 80;
        const y = centerY + radius * Math.sin(angle + angleOffset) - 40;

        const newNode = createNode({
            content: node.content,
            type: 'child',
            x: x,
            y: y
        });
        idMapping.set(node.id, newNode.id);
        nodesModule.addNodeToMap(newNode);
        nodesCreated++;
    });

    // Create connections
    if (mapData.connections) {
        mapData.connections.forEach(conn => {
            const fromId = idMapping.get(conn.from);
            const toId = idMapping.get(conn.to);
            if (fromId && toId) {
                const connection = createConnection(fromId, toId);
                nodesModule.addConnectionToMap(connection);
            }
        });
    }

    // Render everything
    nodesModule.renderAllNodes();

    return { nodesCreated };
}
