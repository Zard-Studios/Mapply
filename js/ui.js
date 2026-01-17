/**
 * ui.js – UI interactions and utilities
 * Handles toasts, modals, and sidebar toggles
 */

import { getTheme, setTheme } from './storage.js';

/**
 * Initialize UI
 */
export function initUI() {
    initTheme();
    initToasts();
}

/**
 * Initialize theme based on stored preference or system
 */
function initTheme() {
    // Get stored theme or detect system preference
    let theme = getTheme();

    if (!theme) {
        theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    applyTheme(theme);

    // Theme toggle button
    document.getElementById('btn-theme')?.addEventListener('click', toggleTheme);
}

/**
 * Apply a theme to the document
 * @param {string} theme - 'light' or 'dark'
 */
function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);

    // Update meta theme-color for mobile browsers
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
        metaTheme.content = theme === 'dark' ? '#1a1a2e' : '#6366f1';
    }
}

/**
 * Toggle between light and dark themes
 */
export function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    const next = current === 'light' ? 'dark' : 'light';

    applyTheme(next);
    setTheme(next);

    showToast(next === 'dark' ? 'Tema scuro attivato' : 'Tema chiaro attivato');
}

/**
 * Initialize toast system
 */
let toastContainer = null;

function initToasts() {
    toastContainer = document.getElementById('toast-container');
}

/**
 * Show a toast notification
 * @param {string} message - Message to display
 * @param {string} type - 'info', 'success', 'warning', or 'error'
 * @param {number} duration - Duration in ms (default 3000)
 */
export function showToast(message, type = 'info', duration = 3000) {
    if (!toastContainer) {
        toastContainer = document.getElementById('toast-container');
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;

    toastContainer.appendChild(toast);

    // Auto-remove after duration
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
        setTimeout(() => toast.remove(), 200);
    }, duration);

    return toast;
}

// Make showToast globally available
window.showToast = showToast;

/**
 * Update the map title element
 * @param {string} title - New title
 */
export function setMapTitle(title) {
    const titleEl = document.getElementById('map-title');
    if (titleEl) {
        titleEl.textContent = title;
    }
}

/**
 * Get current map title from the editable element
 * @returns {string}
 */
export function getMapTitle() {
    const titleEl = document.getElementById('map-title');
    return titleEl?.textContent?.trim() || 'Nuova Mappa';
}

/**
 * Setup map title editing callbacks
 * @param {Function} onChange - Callback when title changes
 */
export function onMapTitleChange(onChange) {
    const titleEl = document.getElementById('map-title');

    if (titleEl) {
        titleEl.addEventListener('blur', () => {
            const newTitle = titleEl.textContent.trim() || 'Nuova Mappa';
            titleEl.textContent = newTitle;
            onChange(newTitle);
        });

        titleEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                titleEl.blur();
            }
        });

        // Live update while typing
        titleEl.addEventListener('input', () => {
            const newTitle = titleEl.textContent.trim() || 'Nuova Mappa';
            onChange(newTitle);
        });
    }
}

/**
 * Render the map list in the sidebar
 * @param {Array} maps - Array of map objects
 * @param {string} activeId - Currently active map ID
 * @param {Object} callbacks - { onSelect, onDelete }
 */
export function renderMapList(maps, activeId, callbacks) {
    const listEl = document.getElementById('map-list');
    if (!listEl) return;

    listEl.innerHTML = '';

    if (maps.length === 0) {
        listEl.innerHTML = '<li class="map-list-empty">Nessuna mappa salvata</li>';
        return;
    }

    maps.forEach(map => {
        const li = document.createElement('li');
        li.className = `map-list-item ${map.id === activeId ? 'active' : ''}`;
        li.dataset.id = map.id; // Add data-id for easy lookup
        li.innerHTML = `
      <svg class="icon-small" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/>
        <circle cx="12" cy="12" r="4"/>
        <line x1="12" y1="2" x2="12" y2="4"/>
        <line x1="12" y1="20" x2="12" y2="22"/>
        <line x1="2" y1="12" x2="4" y2="12"/>
        <line x1="20" y1="12" x2="22" y2="12"/>
      </svg>
      <span class="map-list-item-title">${escapeHtml(map.title)}</span>
      <button class="map-list-item-delete" aria-label="Elimina mappa">
        <svg class="icon-small" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
        </svg>
      </button>
    `;

        // Select on click
        li.addEventListener('click', (e) => {
            if (!e.target.closest('.map-list-item-delete')) {
                callbacks.onSelect?.(map.id);
            }
        });

        // Delete button
        li.querySelector('.map-list-item-delete')?.addEventListener('click', (e) => {
            e.stopPropagation();
            if (confirm(`Eliminare "${map.title}"?`)) {
                callbacks.onDelete?.(map.id);
            }
        });

        listEl.appendChild(li);
    });
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Update the title of a specific map in the sidebar list (Optimistic UI)
 */
export function updateSidebarMapTitle(mapId, newTitle) {
    const listEl = document.getElementById('map-list');
    if (!listEl) return;

    const item = listEl.querySelector(`.map-list-item[data-id="${mapId}"]`);
    if (item) {
        const titleSpan = item.querySelector('.map-list-item-title');
        if (titleSpan) {
            titleSpan.textContent = newTitle;
        }
    }
}
