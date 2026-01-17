/**
 * nodes.js – Node creation, management, and interactions
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
 */
export function initNodes(map, options = {}) {
    nodesLayer = document.getElementById('nodes-layer');
    currentMap = map;
    onNodeChange = options.onNodeChange;

    renderAllNodes();

    document.getElementById('btn-add-node')?.addEventListener('click', () => {
        addNodeAtCenter();
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.node') && !e.target.closest('.node-toolbar')) {
            hideAllToolbars();
            if (selectedNodeId && !e.target.closest('.connection-path')) {
                selectNode(null);
            }
        }
    });

    document.addEventListener('keydown', (e) => {
        if ((e.key === 'Backspace' || e.key === 'Delete') && selectedNodeId) {
            const active = document.activeElement;
            if (active && (active.isContentEditable || active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) {
                return;
            }
            e.preventDefault();
            deleteNode(selectedNodeId);
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
 */
function renderNode(nodeData) {
    const node = document.createElement('div');
    node.className = `node node-${nodeData.type}`;
    node.id = nodeData.id;
    node.style.left = `${nodeData.x}px`;
    node.style.top = `${nodeData.y}px`;

    const fontSize = nodeData.fontSize || DEFAULT_FONT_SIZE;

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
      <div class="font-size-control">
        <input type="number" class="font-size-input" value="${fontSize}" min="8" max="72" title="Digita dimensione">
        <span class="font-size-unit">pt</span>
      </div>
      <div class="toolbar-divider"></div>
      <button class="toolbar-btn delete-btn" data-action="delete" aria-label="Elimina" title="Elimina nodo">
        <svg class="toolbar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
        </svg>
      </button>
    </div>
    <div class="node-content" contenteditable="true" spellcheck="false" data-placeholder="Scrivi qui..." style="font-size: ${fontSize}px;">${nodeData.content || ''}</div>
    <div class="node-handle node-handle-top" data-handle="top"></div>
    <div class="node-handle node-handle-bottom" data-handle="bottom"></div>
    <div class="node-handle node-handle-left" data-handle="left"></div>
    <div class="node-handle node-handle-right" data-handle="right"></div>
  `;

    setupNodeEvents(node, nodeData);
    nodesLayer.appendChild(node);
}

/**
 * Setup event listeners for a node
 */
function setupNodeEvents(nodeEl, nodeData) {
    const toolbar = nodeEl.querySelector('.node-toolbar');
    const contentEl = nodeEl.querySelector('.node-content');

    contentEl.setAttribute('contenteditable', 'false');

    nodeEl.addEventListener('mousedown', (e) => {
        if (e.target.closest('.node-toolbar')) return;
        if (e.target.closest('.node-handle')) return;
        if (window.isSpacePanMode) return;
        if (e.target.closest('.node-content') && contentEl.getAttribute('contenteditable') === 'true') {
            return;
        }
        selectNode(nodeData.id);
        startDrag(e, nodeEl, nodeData);
    });

    nodeEl.addEventListener('dblclick', (e) => {
        if (e.target.closest('.node-toolbar')) return;
        if (e.target.closest('.node-handle')) return;
        if (contentEl.getAttribute('contenteditable') === 'true') return;
        enterEditMode(contentEl, toolbar);
    });

    contentEl.addEventListener('focus', () => {
        showToolbar(toolbar);
    });

    contentEl.addEventListener('blur', () => {
        setTimeout(() => {
            const active = document.activeElement;
            const toToolbar = active?.closest('.node-toolbar');
            if (toToolbar && toToolbar.closest('.node') === nodeEl) return;
            hideToolbar(toolbar);
            contentEl.setAttribute('contenteditable', 'false');
        }, 150);
    });

    toolbar.querySelectorAll('.toolbar-btn').forEach(btn => {
        btn.addEventListener('mousedown', (e) => {
            e.preventDefault();
        });
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const action = btn.dataset.action;
            if (action === 'bold' || action === 'italic' || action === 'underline') {
                applyTextStyle(action);
                updateToolbarState(toolbar, contentEl);
                contentEl.focus();
            } else if (action === 'delete') {
                deleteNode(nodeData.id);
            }
        });
    });

    const fontSizeControl = toolbar.querySelector('.font-size-control');
    const fontInput = toolbar.querySelector('.font-size-input');
    let savedSelection = null;

    if (fontSizeControl && fontInput) {
        fontSizeControl.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            const selection = window.getSelection();
            if (selection.rangeCount > 0 && contentEl.contains(selection.anchorNode) && !selection.isCollapsed) {
                const existing = contentEl.querySelector('.temp-selection-highlight');
                if (existing) return;

                savedSelection = selection.getRangeAt(0).cloneRange();
                try {
                    const range = selection.getRangeAt(0);
                    const span = document.createElement('span');
                    span.className = 'temp-selection-highlight';
                    const fragment = range.extractContents();
                    span.appendChild(fragment);
                    range.insertNode(span);
                } catch (err) {
                    console.warn('Highlight failed', err);
                }
            }
        });

        const removeHighlight = () => {
            const highlights = contentEl.querySelectorAll('.temp-selection-highlight');
            highlights.forEach(span => {
                while (span.firstChild) {
                    span.parentNode.insertBefore(span.firstChild, span);
                }
                span.remove();
            });
            contentEl.normalize();
        };

        fontInput.addEventListener('change', (e) => {
            const size = parseInt(e.target.value);
            if (size >= 8 && size <= 72) {
                // Don't call removeHighlight here, let setNodeFontSize handle it or use it
                setNodeFontSize(nodeEl, nodeData, size);
                contentEl.focus();
            }
        });

        fontInput.addEventListener('blur', () => {
            setTimeout(() => {
                removeHighlight();
            }, 100);
        });

        fontInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const size = parseInt(e.target.value);
                if (size >= 8 && size <= 72) {
                    setNodeFontSize(nodeEl, nodeData, size);
                    contentEl.focus();
                }
            }
        });
    }

    contentEl.addEventListener('input', () => {
        updateNodeField(nodeData.id, 'content', contentEl.innerHTML);
        updateConnections(currentMap);
    });

    contentEl.addEventListener('keydown', (e) => {
        if (e.ctrlKey || e.metaKey) {
            if (e.key === 'b') { e.preventDefault(); applyTextStyle('bold'); }
            else if (e.key === 'i') { e.preventDefault(); applyTextStyle('italic'); }
            else if (e.key === 'u') { e.preventDefault(); applyTextStyle('underline'); }
        }
    });

    contentEl.addEventListener('mouseup', () => updateToolbarState(toolbar, contentEl));
    contentEl.addEventListener('keyup', () => updateToolbarState(toolbar, contentEl));

    nodeEl.querySelectorAll('.node-handle').forEach(handle => {
        handle.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            startConnection(nodeData.id);
        });
    });
}

/**
 * Enter edit mode
 */
function enterEditMode(contentEl, toolbar) {
    contentEl.setAttribute('contenteditable', 'true');
    contentEl.focus();
    const range = document.createRange();
    range.selectNodeContents(contentEl);
    range.collapse(false);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    showToolbar(toolbar);
}

/**
 * Show toolbar
 */
function showToolbar(toolbar) {
    const node = toolbar.closest('.node');
    hideAllToolbars(node);
    toolbar.dataset.visible = 'true';
    activeToolbar = toolbar;
    const contentEl = node?.querySelector('.node-content');
    if (contentEl) updateToolbarState(toolbar, contentEl);
}

/**
 * Hide toolbar
 */
function hideToolbar(toolbar) {
    if (!toolbar) return;
    toolbar.dataset.visible = 'false';
    if (activeToolbar === toolbar) activeToolbar = null;
}

/**
 * Hide all toolbars
 */
function hideAllToolbars(excludeNode = null) {
    document.querySelectorAll('.node-toolbar[data-visible="true"]').forEach(t => {
        const node = t.closest('.node');
        if (excludeNode && node === excludeNode) return;
        t.dataset.visible = 'false';
        if (node) {
            const content = node.querySelector('.node-content');
            if (content) content.setAttribute('contenteditable', 'false');
        }
    });
    document.querySelectorAll('.node-content[contenteditable="true"]').forEach(el => {
        const node = el.closest('.node');
        if (excludeNode && node === excludeNode) return;
        el.setAttribute('contenteditable', 'false');
    });
    if (!excludeNode) activeToolbar = null;
}

/**
 * Set font size
 */
function setNodeFontSize(nodeEl, nodeData, size) {
    const contentEl = nodeEl.querySelector('.node-content');

    // 1. Check for visual highlight (fake selection)
    const highlight = contentEl.querySelector('.temp-selection-highlight');
    if (highlight) {
        highlight.style.fontSize = `${size}px`;
        highlight.classList.remove('temp-selection-highlight');
        updateConnections(currentMap);
        onNodeChange?.();
        return;
    }
    // 2. Fallback to real selection
    const selection = window.getSelection();
    let hasSelection = selection && selection.rangeCount > 0 && !selection.isCollapsed && contentEl.contains(selection.anchorNode);

    if (hasSelection) {
        const range = selection.getRangeAt(0);
        if (contentEl.contains(range.commonAncestorContainer) || range.commonAncestorContainer === contentEl) {
            const span = document.createElement('span');
            span.style.fontSize = `${size}px`;
            try {
                const fragment = range.extractContents();
                span.appendChild(fragment);
                range.insertNode(span);

                selection.removeAllRanges();
                const newRange = document.createRange();
                newRange.selectNodeContents(span);
                selection.addRange(newRange);

                updateConnections(currentMap);
                onNodeChange?.();
                return;
            } catch (e) {
                console.error('Font resize error', e);
            }
        }
    }

    // 3. No selection = apply to entire node
    contentEl.style.fontSize = `${size}px`;
    updateNodeField(nodeData.id, 'fontSize', size);
    updateConnections(currentMap);
}

/**
 * Apply style
 */
function applyTextStyle(style) {
    document.execCommand(style, false, null);
}

/**
 * Update toolbar button states
 */
function updateToolbarState(toolbar, contentEl) {
    if (!toolbar) return;
    const isBold = document.queryCommandState('bold');
    const isItalic = document.queryCommandState('italic');
    const isUnderline = document.queryCommandState('underline');

    toolbar.querySelector('[data-action="bold"]')?.classList.toggle('active', isBold);
    toolbar.querySelector('[data-action="italic"]')?.classList.toggle('active', isItalic);
    toolbar.querySelector('[data-action="underline"]')?.classList.toggle('active', isUnderline);

    const selection = window.getSelection();
    if (selection.rangeCount > 0 && !selection.isCollapsed) {
        const range = selection.getRangeAt(0);
        let container = range.commonAncestorContainer;
        if (container.nodeType === Node.TEXT_NODE) container = container.parentElement;
        const fontSize = window.getComputedStyle(container).fontSize;
        const sizeNum = parseInt(fontSize);
        const fontInput = toolbar.querySelector('.font-size-input');
        if (fontInput && sizeNum) fontInput.value = sizeNum;
    }
}

/**
 * Start dragging
 */
function startDrag(e, nodeEl, nodeData) {
    if (dragState) {
        document.getElementById(dragState.nodeId)?.classList.remove('dragging');
    }
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
    const onMouseMove = (me) => {
        if (!dragState) return;
        const el = document.getElementById(dragState.nodeId);
        if (!el) return;
        const { scale } = window.canvasTransform || { scale: 1 };
        const dx = (me.clientX - dragState.startX) / scale;
        const dy = (me.clientY - dragState.startY) / scale;
        el.style.left = `${dragState.nodeStartX + dx}px`;
        el.style.top = `${dragState.nodeStartY + dy}px`;
        updateConnections(currentMap);
    };
    const onMouseUp = (ue) => {
        if (!dragState) return;
        const el = document.getElementById(dragState.nodeId);
        const { scale } = window.canvasTransform || { scale: 1 };
        const dx = (ue.clientX - dragState.startX) / scale;
        const dy = (ue.clientY - dragState.startY) / scale;
        updateNodeField(dragState.nodeId, 'x', Math.round(dragState.nodeStartX + dx));
        updateNodeField(dragState.nodeId, 'y', Math.round(dragState.nodeStartY + dy));
        el?.classList.remove('dragging');
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
    if (selectedNodeId) document.getElementById(selectedNodeId)?.classList.remove('selected');
    selectedNodeId = nodeId;
    if (nodeId) document.getElementById(nodeId)?.classList.add('selected');
}

/**
 * Add node at center
 */
export function addNodeAtCenter() {
    if (!currentMap) return;
    const container = document.getElementById('canvas-container');
    const rect = container.getBoundingClientRect();
    const center = screenToCanvas(rect.left + rect.width / 2, rect.top + rect.height / 2);
    const hasMain = currentMap.nodes.some(n => n.type === 'main');
    const type = !hasMain ? 'main' : 'secondary';
    const node = createNode({ type, content: '', fontSize: DEFAULT_FONT_SIZE, x: Math.round(center.x), y: Math.round(center.y) });
    currentMap.nodes.push(node);
    renderNode(node);
    selectNode(node.id);
    setTimeout(() => { document.querySelector(`#${node.id} .node-content`)?.focus(); }, 50);
}

/**
 * Delete a node
 */
export function deleteNode(nodeId) {
    if (!currentMap) return;
    const index = currentMap.nodes.findIndex(n => n.id === nodeId);
    if (index === -1) return;
    currentMap.nodes.splice(index, 1);
    currentMap.connections = currentMap.connections.filter(c => c.from !== nodeId && c.to !== nodeId);
    document.getElementById(nodeId)?.remove();
    if (selectedNodeId === nodeId) selectedNodeId = null;
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
 * Start connection
 */
function startConnection(fromNodeId) {
    const container = document.getElementById('canvas-container');
    container.classList.add('connecting');
    import('./connections.js').then(({ startConnectionPreview, endConnectionPreview }) => {
        startConnectionPreview(fromNodeId);
        const onMouseUp = (e) => {
            container.classList.remove('connecting');
            endConnectionPreview();
            const target = e.target.closest('.node-handle') || e.target.closest('.node');
            if (target) {
                const toNodeEl = target.closest('.node');
                if (toNodeEl && toNodeEl.id !== fromNodeId) createNodeConnection(fromNodeId, toNodeEl.id);
            }
            document.removeEventListener('mouseup', onMouseUp);
        };
        document.addEventListener('mouseup', onMouseUp);
    });
}

/**
 * Create connection
 */
function createNodeConnection(fromId, toId) {
    if (!currentMap) return;
    const exists = currentMap.connections.some(c => (c.from === fromId && c.to === toId) || (c.from === toId && c.to === fromId));
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
