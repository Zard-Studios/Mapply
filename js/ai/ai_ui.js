
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

    // Message history for context
    let messageHistory = [];

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

        // Add User Message to UI and history
        appendMessage('user', text);
        messageHistory.push({ role: 'user', content: text });

        inputPrompt.value = '';
        inputPrompt.style.height = 'auto';

        // Placeholder for AI thinking
        const loadingId = appendMessage('system', 'Sto pensando...', true);

        try {
            // Get current map context
            const mapContext = await getCurrentMapContext();

            // Build messages with context
            const messagesWithContext = [...messageHistory];
            if (mapContext) {
                // Add map context as a system message at the start
                messagesWithContext.unshift({
                    role: 'system',
                    content: `MAPPA ATTUALE dell'utente:\n${mapContext}\n\nL'utente può chiederti di AGGIUNGERE nodi alla mappa esistente, ESPANDERE un argomento, o creare una nuova mappa.`
                });
            }

            // Call AI Service with full history
            const response = await aiService.generateCompletion(messagesWithContext);

            // Add AI response to history
            messageHistory.push({ role: 'assistant', content: response });

            // Try to parse JSON from response
            const mapData = extractMapJSON(response);

            console.log('[AI] Parsed mapData:', mapData);

            if (mapData && mapData.nodes && mapData.nodes.length > 0) {
                // Create nodes on the canvas!
                const result = await createMapFromAI(mapData);
                if (result.nodesCreated > 0) {
                    updateMessage(loadingId, `✨ Ho aggiunto ${result.nodesCreated} nodi alla mappa!`);
                } else if (result.connectionsCreated > 0) {
                    updateMessage(loadingId, `✨ Ho collegato i nodi esistenti!`);
                } else {
                    updateMessage(loadingId, response);
                }
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
 * Get current map context for AI
 * Returns nodes with IDs so AI can reference them when adding new nodes
 */
async function getCurrentMapContext() {
    try {
        const { getCurrentMap } = await import('../app.js');
        const map = getCurrentMap();

        if (!map || !map.nodes || map.nodes.length === 0) {
            return null;
        }

        // Build context with actual IDs
        let context = `NODI ESISTENTI (usa questi ID per collegare nuovi nodi):\n`;
        map.nodes.forEach(node => {
            const typeLabel = node.type === 'main' ? 'PRINCIPALE' :
                node.type === 'secondary' ? 'SECONDARIO' : 'DETTAGLIO';
            const content = node.content?.substring(0, 60) || '(vuoto)';
            context += `- ID: "${node.id}" | Tipo: ${typeLabel} | Contenuto: "${content}"\n`;
        });

        // Add connections info
        if (map.connections && map.connections.length > 0) {
            context += `\nCONNESSIONI ESISTENTI:\n`;

            map.connections.forEach(conn => {
                context += `- "${conn.from}" → "${conn.to}"\n`;
            });
        }

        return context;
    } catch (e) {
        console.warn('Could not get map context:', e);
        return null;
    }
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
 * Parse markdown-style formatting to HTML
 * Supports **bold** and *italic*
 */
function parseMarkdownToHTML(text) {
    if (!text) return text;
    // Bold: **text** -> <strong>text</strong>
    text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    // Italic: *text* -> <em>text</em> (but not if already part of bold)
    text = text.replace(/(?<!\*)\*([^*]+?)\*(?!\*)/g, '<em>$1</em>');
    return text;
}

/**
 * Create nodes and connections on the canvas from AI-generated data
 * Uses HIERARCHICAL TOP-DOWN layout
 */
async function createMapFromAI(mapData) {
    const { createNode, createConnection } = await import('../schema.js');
    const nodesModule = await import('../nodes.js');
    const { getCurrentMap } = await import('../app.js');

    const idMapping = new Map(); // AI ID -> Real ID
    let nodesCreated = 0;

    // Get existing node IDs from current map
    const currentMap = getCurrentMap();
    const existingNodeIds = new Set();
    if (currentMap?.nodes) {
        currentMap.nodes.forEach(n => existingNodeIds.add(n.id));
    }

    // Calculate starting position (offset from existing nodes)
    const canvas = document.getElementById('viewport');
    const rect = canvas?.getBoundingClientRect() || { width: 1200, height: 800 };

    // Find rightmost existing node to add new ones to the right
    let startX = rect.width / 2;
    let startY = 100;
    if (currentMap?.nodes?.length > 0) {
        const rightmostNode = currentMap.nodes.reduce((max, n) =>
            (n.x || 0) > (max.x || 0) ? n : max, currentMap.nodes[0]);
        startX = (rightmostNode.x || 0) + 400; // Add to the right of existing
        startY = rightmostNode.y || 100;
    }

    // Separate ONLY NEW nodes (not existing ones)
    const newNodes = mapData.nodes.filter(n => !existingNodeIds.has(n.id));
    const mainNode = newNodes.find(n => n.type === 'main');
    const secondaryNodes = newNodes.filter(n => n.type === 'secondary');
    const childNodes = newNodes.filter(n => n.type === 'child');

    // Pre-map existing IDs (for connections to existing nodes)
    existingNodeIds.forEach(id => idMapping.set(id, id));

    // Build parent-child relationships from connections
    const childrenOf = new Map(); // parentId -> [childIds]
    mapData.connections.forEach(conn => {
        if (!childrenOf.has(conn.from)) childrenOf.set(conn.from, []);
        childrenOf.get(conn.from).push(conn.to);
    });

    // Layout constants - MUCH MORE SPACING!
    const nodeWidth = 240;
    const horizontalSpacing = 450; // Was 350
    const verticalSpacing = 250;   // Was 200

    // LEVEL 1: Main node at top center
    if (mainNode) {
        const newNode = createNode({
            content: parseMarkdownToHTML(mainNode.content),
            type: 'main',
            x: startX - nodeWidth / 2,
            y: startY
        });
        idMapping.set(mainNode.id, newNode.id);
        nodesModule.addNodeToMap(newNode);
        nodesCreated++;
    }

    // LEVEL 2: Secondary nodes spread horizontally below main
    const totalSecondary = secondaryNodes.length;
    const totalSecondaryWidth = totalSecondary * horizontalSpacing;
    const secondaryStartX = startX - totalSecondaryWidth / 2 + horizontalSpacing / 2;
    const secondaryY = startY + verticalSpacing;

    secondaryNodes.forEach((node, i) => {
        const x = secondaryStartX + i * horizontalSpacing - nodeWidth / 2;
        const newNode = createNode({
            content: parseMarkdownToHTML(node.content),
            type: 'secondary',
            x: x,
            y: secondaryY
        });
        idMapping.set(node.id, newNode.id);
        nodesModule.addNodeToMap(newNode);
        nodesCreated++;
    });

    // LEVEL 3+: Child nodes below their parents (new secondary parents)
    secondaryNodes.forEach((secNode, secIndex) => {
        const children = childrenOf.get(secNode.id) || [];
        const secX = secondaryStartX + secIndex * horizontalSpacing - nodeWidth / 2;

        children.forEach((childId, childIndex) => {
            const childData = childNodes.find(n => n.id === childId);
            if (!childData) return;

            const childY = secondaryY + verticalSpacing + childIndex * 200;
            const newNode = createNode({
                content: parseMarkdownToHTML(childData.content),
                type: 'child',
                x: secX,
                y: childY
            });
            idMapping.set(childData.id, newNode.id);
            nodesModule.addNodeToMap(newNode);
            nodesCreated++;
        });
    });

    // Handle child nodes connected to EXISTING parents
    childNodes.forEach((childNode, i) => {
        // Skip if already added
        if (idMapping.has(childNode.id)) return;

        // Find parent in connections
        const parentConn = mapData.connections.find(c => c.to === childNode.id);
        if (!parentConn) return;

        // Check if parent exists in current map
        if (existingNodeIds.has(parentConn.from)) {
            // Find parent node position
            const parentNode = currentMap.nodes.find(n => n.id === parentConn.from);
            const parentX = parentNode?.x || startX;
            const parentY = parentNode?.y || startY;

            const newNode = createNode({
                content: parseMarkdownToHTML(childNode.content),
                type: 'child',
                x: parentX,
                y: parentY + 180 // Below parent
            });
            idMapping.set(childNode.id, newNode.id);
            nodesModule.addNodeToMap(newNode);
            nodesCreated++;

            console.log('[AI] Added child node connected to existing parent:', childNode.content);
        }
    });

    // Create connections
    let connectionsCreated = 0;
    if (mapData.connections) {
        mapData.connections.forEach(conn => {
            const fromId = idMapping.get(conn.from);
            const toId = idMapping.get(conn.to);
            if (fromId && toId) {
                const connection = createConnection(fromId, toId);
                nodesModule.addConnectionToMap(connection);
                connectionsCreated++;
            }
        });
    }

    // Render everything
    nodesModule.renderAllNodes();

    // Force connection update after DOM settles
    setTimeout(async () => {
        const { updateConnections } = await import('../connections.js');
        const { getCurrentMap } = await import('../app.js');
        const map = getCurrentMap();
        if (map) updateConnections(map);
    }, 100);

    console.log('[AI] Created nodes:', nodesCreated, 'connections:', connectionsCreated);
    return { nodesCreated, connectionsCreated };
}
