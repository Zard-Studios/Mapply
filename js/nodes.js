/**
 * nodes.js – Node creation, management, and interactions
 * 
 * Features:
 * - Animated floating toolbar (appears on focus, hides on blur)
 * - Text styling: Bold, Italic, Underline, Font Size
 * - 18pt default font size
 * - Drag & drop with smooth connections
 */

import { createNode, createConnection } from './schema.js';
import { screenToCanvas } from './canvas.js';
import { updateConnections } from './connections.js';

// State
let nodesLayer = null;
let currentMap = null;
let selectedNodeId = null;
let dragState = null;
let activeToolbar = null; // Track which toolbar is visible

// Callbacks
let onNodeChange = null;

// Font size presets
const FONT_SIZES = [14, 18, 24, 32];
const DEFAULT_FONT_SIZE = 18;

/**
 * Initialize nodes module
 * @param {Object} map - Current map data
 * @param {Object} options - Callbacks
 */
export function initNodes(map, options = {}) {
    nodesLayer = document.getElementById('nodes-layer');
    currentMap = map;
    onNodeChange = options.onNodeChange;

    // Render all nodes from map
    renderAllNodes();

    // Setup add node button
    document.getElementById('btn-add-node')?.addEventListener('click', () => {
        addNodeAtCenter();
    });

    // Click outside to hide toolbar
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.node') && !e.target.closest('.node-toolbar')) {
            hideAllToolbars();
        }
    });
}

/**
 * Update the current map reference
 */
export function setCurrentMap(map) {
    currentMap = map;
    renderAllNodes();
}

/**
 * Render all nodes from current map
 */
export function renderAllNodes() {
    nodesLayer.innerHTML = '';

    if (!currentMap || !currentMap.nodes) return;

    currentMap.nodes.forEach(node => {
        renderNode(node);
    });
}

/**
 * Render a single node
 * @param {Object} nodeData - Node data object
 */
function renderNode(nodeData) {
    const node = document.createElement('div');
    node.className = `node node-${nodeData.type}`;
    node.id = nodeData.id;
    node.style.left = `${nodeData.x}px`;
    node.style.top = `${nodeData.y}px`;

    // Get stored font size or use default
    const fontSize = nodeData.fontSize || DEFAULT_FONT_SIZE;

    // Node with animated toolbar
    node.innerHTML = `
    <div class="node-toolbar" data-visible="false">
      <button class="toolbar-btn" data-action="bold" aria-label="Grassetto" title="Grassetto (Ctrl+B)">
        <span class="toolbar-label">B</span>
      </button>
      <button class="toolbar-btn" data-action="italic" aria-label="Corsivo" title="Corsivo (Ctrl+I)">
        <span class="toolbar-label italic">I</span>
      </button>
      <button class="toolbar-btn" data-action="underline" aria-label="Sottolineato" title="Sottolineato (Ctrl+U)">
        <span class="toolbar-label underline">U</span>
      </button>
      <div class="toolbar-divider"></div>
      <button class="toolbar-btn font-size-btn" data-action="fontSize" aria-label="Dimensione testo" title="Dimensione testo">
        <span class="toolbar-label">${fontSize}</span>
        <svg class="toolbar-icon-small" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>
      <div class="toolbar-divider"></div>
      <button class="toolbar-btn delete-btn" data-action="delete" aria-label="Elimina" title="Elimina nodo">
        <svg class="toolbar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
        </svg>
      </button>
    </div>
    <div class="font-size-dropdown" data-visible="false">
      ${FONT_SIZES.map(size => `
        <button class="font-size-option ${size === fontSize ? 'active' : ''}" data-size="${size}">${size}pt</button>
      `).join('')}
    </div>
    <div class="node-content" contenteditable="true" spellcheck="false" data-placeholder="Scrivi qui..." style="font-size: ${fontSize}px;">${nodeData.content || ''}</div>
    <div class="node-handle node-handle-top" data-handle="top"></div>
    <div class="node-handle node-handle-bottom" data-handle="bottom"></div>
    <div class="node-handle node-handle-left" data-handle="left"></div>
    <div class="node-handle node-handle-right" data-handle="right"></div>
  `;

    // Setup event listeners
    setupNodeEvents(node, nodeData);

    nodesLayer.appendChild(node);
}

/**
 * Setup event listeners for a node
 */
function setupNodeEvents(nodeEl, nodeData) {
    const toolbar = nodeEl.querySelector('.node-toolbar');
    const contentEl = nodeEl.querySelector('.node-content');
    const fontDropdown = nodeEl.querySelector('.font-size-dropdown');

    // Disable default contenteditable behavior - we control it with double-click
    contentEl.setAttribute('contenteditable', 'false');

    // Single click = select and prepare for drag
    nodeEl.addEventListener('mousedown', (e) => {
        if (e.target.closest('.node-toolbar') || e.target.closest('.font-size-dropdown')) return;
        if (e.target.closest('.node-handle')) return;

        selectNode(nodeData.id);
        startDrag(e, nodeEl, nodeData);
    });

    // Double click = enter edit mode
    nodeEl.addEventListener('dblclick', (e) => {
        if (e.target.closest('.node-toolbar') || e.target.closest('.font-size-dropdown')) return;
        if (e.target.closest('.node-handle')) return;

        enterEditMode(contentEl, toolbar);
    });

    // Show toolbar on focus (content editing)
    contentEl.addEventListener('focus', () => {
        showToolbar(toolbar);
    });

    // Hide toolbar on blur (with delay for clicking toolbar buttons)
    contentEl.addEventListener('blur', () => {
        setTimeout(() => {
            if (!document.activeElement?.closest('.node-toolbar') &&
                !document.activeElement?.closest('.font-size-dropdown')) {
                hideToolbar(toolbar);
                hideFontDropdown(fontDropdown);
                // Exit edit mode
                contentEl.setAttribute('contenteditable', 'false');
            }
        }, 150);
    });

    // Toolbar buttons
    toolbar.querySelectorAll('.toolbar-btn').forEach(btn => {
        btn.addEventListener('mousedown', (e) => {
            e.preventDefault(); // Prevent blur
        });

        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const action = btn.dataset.action;

            if (action === 'bold' || action === 'italic' || action === 'underline') {
                applyTextStyle(action);
                contentEl.focus();
            } else if (action === 'fontSize') {
                toggleFontDropdown(fontDropdown);
            } else if (action === 'delete') {
                deleteNode(nodeData.id);
            }
        });
    });

    // Font size options
    fontDropdown.querySelectorAll('.font-size-option').forEach(option => {
        option.addEventListener('mousedown', (e) => {
            e.preventDefault();
        });

        option.addEventListener('click', (e) => {
            e.stopPropagation();
            const size = parseInt(option.dataset.size);
            setNodeFontSize(nodeEl, nodeData, size);
            hideFontDropdown(fontDropdown);
            contentEl.focus();
        });
    });

    // Content editing
    contentEl.addEventListener('input', () => {
        updateNodeField(nodeData.id, 'content', contentEl.innerHTML);
        // Update connections after content change (size might change)
        updateConnections(currentMap);
    });

    // Keyboard shortcuts
    contentEl.addEventListener('keydown', (e) => {
        if (e.ctrlKey || e.metaKey) {
            if (e.key === 'b') {
                e.preventDefault();
                applyTextStyle('bold');
            } else if (e.key === 'i') {
                e.preventDefault();
                applyTextStyle('italic');
            } else if (e.key === 'u') {
                e.preventDefault();
                applyTextStyle('underline');
            }
        }
    });

    // Connection handles
    nodeEl.querySelectorAll('.node-handle').forEach(handle => {
        handle.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            startConnection(nodeData.id);
        });
    });
}

/**
 * Enter edit mode on double-click
 */
function enterEditMode(contentEl, toolbar) {
    contentEl.setAttribute('contenteditable', 'true');
    contentEl.focus();

    // Place cursor at end of content
    const range = document.createRange();
    range.selectNodeContents(contentEl);
    range.collapse(false);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);

    showToolbar(toolbar);
}

/**
 * Show toolbar with playful animation
 */
function showToolbar(toolbar) {
    hideAllToolbars();
    toolbar.dataset.visible = 'true';
    activeToolbar = toolbar;
}

/**
 * Hide toolbar with animation
 */
function hideToolbar(toolbar) {
    toolbar.dataset.visible = 'false';
    if (activeToolbar === toolbar) {
        activeToolbar = null;
    }
}

/**
 * Hide all toolbars
 */
function hideAllToolbars() {
    document.querySelectorAll('.node-toolbar[data-visible="true"]').forEach(t => {
        t.dataset.visible = 'false';
    });
    document.querySelectorAll('.font-size-dropdown[data-visible="true"]').forEach(d => {
        d.dataset.visible = 'false';
    });
    activeToolbar = null;
}

/**
 * Toggle font size dropdown
 */
function toggleFontDropdown(dropdown) {
    dropdown.dataset.visible = dropdown.dataset.visible === 'true' ? 'false' : 'true';
}

/**
 * Hide font dropdown
 */
function hideFontDropdown(dropdown) {
    dropdown.dataset.visible = 'false';
}

/**
 * Set node font size
 */
function setNodeFontSize(nodeEl, nodeData, size) {
    const contentEl = nodeEl.querySelector('.node-content');
    const fontBtn = nodeEl.querySelector('.font-size-btn .toolbar-label');
    const dropdown = nodeEl.querySelector('.font-size-dropdown');

    contentEl.style.fontSize = `${size}px`;
    fontBtn.textContent = size;

    // Update active state
    dropdown.querySelectorAll('.font-size-option').forEach(opt => {
        opt.classList.toggle('active', parseInt(opt.dataset.size) === size);
    });

    // Save to data
    updateNodeField(nodeData.id, 'fontSize', size);

    // Update connections (node size changed)
    updateConnections(currentMap);
}

/**
 * Apply text style to selected text
 */
function applyTextStyle(style) {
    document.execCommand(style, false, null);
}

/**
 * Start dragging a node
 */
function startDrag(e, nodeEl, nodeData) {
    const currentX = parseFloat(nodeEl.style.left) || nodeData.x;
    const currentY = parseFloat(nodeEl.style.top) || nodeData.y;

    dragState = {
        nodeId: nodeData.id,
        startX: e.clientX,
        startY: e.clientY,
        nodeStartX: currentX,
        nodeStartY: currentY
    };

    nodeEl.classList.add('dragging');

    const onMouseMove = (moveEvent) => {
        if (!dragState) return;

        const { scale } = window.canvasTransform || { scale: 1 };
        const dx = (moveEvent.clientX - dragState.startX) / scale;
        const dy = (moveEvent.clientY - dragState.startY) / scale;

        const newX = dragState.nodeStartX + dx;
        const newY = dragState.nodeStartY + dy;

        nodeEl.style.left = `${newX}px`;
        nodeEl.style.top = `${newY}px`;

        updateConnections(currentMap);
    };

    const onMouseUp = (upEvent) => {
        if (!dragState) return;

        const { scale } = window.canvasTransform || { scale: 1 };
        const dx = (upEvent.clientX - dragState.startX) / scale;
        const dy = (upEvent.clientY - dragState.startY) / scale;

        const newX = dragState.nodeStartX + dx;
        const newY = dragState.nodeStartY + dy;

        updateNodeField(dragState.nodeId, 'x', Math.round(newX));
        updateNodeField(dragState.nodeId, 'y', Math.round(newY));

        nodeEl.classList.remove('dragging');
        dragState = null;

        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
}

/**
 * Select a node
 */
export function selectNode(nodeId) {
    if (selectedNodeId) {
        document.getElementById(selectedNodeId)?.classList.remove('selected');
    }

    selectedNodeId = nodeId;

    if (nodeId) {
        document.getElementById(nodeId)?.classList.add('selected');
    }
}

/**
 * Add a new node at canvas center
 */
export function addNodeAtCenter() {
    if (!currentMap) return;

    const container = document.getElementById('canvas-container');
    const rect = container.getBoundingClientRect();
    const center = screenToCanvas(
        rect.left + rect.width / 2,
        rect.top + rect.height / 2
    );

    const hasMain = currentMap.nodes.some(n => n.type === 'main');
    const type = !hasMain ? 'main' : 'secondary';

    const node = createNode({
        type,
        content: '',
        fontSize: DEFAULT_FONT_SIZE,
        x: Math.round(center.x),
        y: Math.round(center.y)
    });

    currentMap.nodes.push(node);
    renderNode(node);
    selectNode(node.id);

    setTimeout(() => {
        const contentEl = document.querySelector(`#${node.id} .node-content`);
        contentEl?.focus();
    }, 50);

    onNodeChange?.();
}

/**
 * Delete a node
 */
export function deleteNode(nodeId) {
    if (!currentMap) return;

    const index = currentMap.nodes.findIndex(n => n.id === nodeId);
    if (index === -1) return;

    currentMap.nodes.splice(index, 1);
    currentMap.connections = currentMap.connections.filter(
        c => c.from !== nodeId && c.to !== nodeId
    );

    document.getElementById(nodeId)?.remove();

    if (selectedNodeId === nodeId) {
        selectedNodeId = null;
    }

    updateConnections(currentMap);
    onNodeChange?.();
}

/**
 * Update a node field
 */
function updateNodeField(nodeId, field, value) {
    if (!currentMap) return;

    const node = currentMap.nodes.find(n => n.id === nodeId);
    if (node) {
        node[field] = value;
        onNodeChange?.();
    }
}

/**
 * Start creating a connection with live preview
 */
function startConnection(fromNodeId) {
    const container = document.getElementById('canvas-container');
    container.classList.add('connecting');

    // Import and start preview
    import('./connections.js').then(({ startConnectionPreview, endConnectionPreview }) => {
        startConnectionPreview(fromNodeId);

        const onMouseUp = (e) => {
            container.classList.remove('connecting');
            endConnectionPreview();

            const target = e.target.closest('.node-handle') || e.target.closest('.node');
            if (target) {
                const toNodeEl = target.closest('.node');
                if (toNodeEl && toNodeEl.id !== fromNodeId) {
                    createNodeConnection(fromNodeId, toNodeEl.id);
                }
            }

            document.removeEventListener('mouseup', onMouseUp);
        };

        document.addEventListener('mouseup', onMouseUp);
    });
}

/**
 * Create a connection between two nodes
 */
function createNodeConnection(fromId, toId) {
    if (!currentMap) return;

    const exists = currentMap.connections.some(
        c => (c.from === fromId && c.to === toId) || (c.from === toId && c.to === fromId)
    );

    if (exists) return;

    const connection = createConnection(fromId, toId);
    currentMap.connections.push(connection);

    updateConnections(currentMap);
    onNodeChange?.();
}

/**
 * Get selected node ID
 */
export function getSelectedNodeId() {
    return selectedNodeId;
}
