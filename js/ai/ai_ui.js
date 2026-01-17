
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
    selectModel.value = aiService.getModel();

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
            // Check for commands (simplistic for now)
            let prompt = text;

            // Call AI Service
            // We'll implement a proper message history later if needed
            // For now, simpler one-shot contexts
            const response = await aiService.generateCompletion([
                { role: 'user', content: prompt }
            ]);

            // Update loading message with response
            updateMessage(loadingId, response);

            // Try to parse JSON actions?
            // This is where "sophisticated" logic comes in.
            // For now, raw text.

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
