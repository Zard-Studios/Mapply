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

    // Click outside to hide toolbar and deselect
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.node') && !e.target.closest('.node-toolbar')) {
            hideAllToolbars();
            // Deselect node when clicking outside
            if (selectedNodeId && !e.target.closest('.connection-path')) {
                selectNode(null);
            }
        }
    });

    // Delete selected node with Backspace or Delete key
    document.addEventListener('keydown', (e) => {
        if ((e.key === 'Backspace' || e.key === 'Delete') && selectedNodeId) {
            // Don't delete if user is editing text
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
    // BUT: not on content area when editing, and not if spacebar held
    nodeEl.addEventListener('mousedown', (e) => {
        if (e.target.closest('.node-toolbar') || e.target.closest('.font-size-dropdown')) return;
        if (e.target.closest('.node-handle')) return;

        // If spacebar is held (pan mode), don't start drag - let canvas handle it
        if (window.isSpacePanMode) return;

        // If clicking on content area while in edit mode, don't drag - allow text selection
        if (e.target.closest('.node-content') && contentEl.getAttribute('contenteditable') === 'true') {
            return; // Let text selection work
        }

        selectNode(nodeData.id);
        startDrag(e, nodeEl, nodeData);
    });

    // Double click = enter edit mode (if not already editing)
    nodeEl.addEventListener('dblclick', (e) => {
        if (e.target.closest('.node-toolbar') || e.target.closest('.font-size-dropdown')) return;
        if (e.target.closest('.node-handle')) return;

        // If already in edit mode, let browser handle double-click (word selection)
        if (contentEl.getAttribute('contenteditable') === 'true') {
            return; // Browser will select the word automatically
        }

        enterEditMode(contentEl, toolbar);
    });

    // Show toolbar on focus (content editing)
    contentEl.addEventListener('focus', () => {
        showToolbar(toolbar);
    });

    // Hide toolbar on blur (with delay for clicking toolbar buttons)
    contentEl.addEventListener('blur', () => {
        setTimeout(() => {
            const active = document.activeElement;
            // Don't exit if focus went to toolbar or font controls
            if (active?.closest('.node-toolbar') ||
                active?.closest('.font-size-dropdown') ||
                active?.closest('.font-size-input') ||
                active?.closest('.font-size-control')) {
                return; // Stay in edit mode
            }

            // Exit edit mode
            hideToolbar(toolbar);
            hideFontDropdown(fontDropdown);
            contentEl.setAttribute('contenteditable', 'false');
        }, 150);
    });

    // Toolbar buttons (B, I, U, delete)
    toolbar.querySelectorAll('.toolbar-btn').forEach(btn => {
        btn.addEventListener('mousedown', (e) => {
            e.preventDefault(); // Prevent blur
        });

        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const action = btn.dataset.action;

            if (action === 'bold' || action === 'italic' || action === 'underline') {
                applyTextStyle(action);
                // Update toolbar state immediately
                updateToolbarState(toolbar, contentEl);
                contentEl.focus();
            } else if (action === 'delete') {
                deleteNode(nodeData.id);
            }
        });
    });

    // Font size INPUT (manual entry)
    const fontInput = toolbar.querySelector('.font-size-input');
    let savedSelection = null; // Save selection before input focus

    if (fontInput) {
        // Save selection BEFORE focus moves to input
        fontInput.addEventListener('mousedown', (e) => {
            e.stopPropagation(); // Don't trigger drag

            // Save the current selection from content area
            const selection = window.getSelection();
            if (selection.rangeCount > 0 && contentEl.contains(selection.anchorNode)) {
                savedSelection = selection.getRangeAt(0).cloneRange();
            }
        });

        fontInput.addEventListener('change', (e) => {
            const size = parseInt(e.target.value);
            if (size >= 8 && size <= 72) {
                // Pass savedSelection if it exists
                setNodeFontSize(nodeEl, nodeData, size, savedSelection);
                savedSelection = null;
                contentEl.focus();
            }
        });

        fontInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const size = parseInt(e.target.value);
                if (size >= 8 && size <= 72) {
                    // Pass savedSelection if it exists
                    setNodeFontSize(nodeEl, nodeData, size, savedSelection);
                    savedSelection = null;
                    contentEl.focus();
                }
            }
        });
    }

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

    // Update toolbar state when selection changes
    contentEl.addEventListener('mouseup', () => {
        updateToolbarState(toolbar, contentEl);
    });

    contentEl.addEventListener('keyup', () => {
        updateToolbarState(toolbar, contentEl);
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
    const node = toolbar.closest('.node');
    hideAllToolbars(node); // Keep this node active!

    toolbar.dataset.visible = 'true';
    activeToolbar = toolbar;

    // Also update toolbar state immediately to reflect current selection
    const contentEl = node?.querySelector('.node-content');
    if (contentEl) {
        updateToolbarState(toolbar, contentEl);
    }
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
/**
 * Hide all toolbars AND disable editing
 */
/**
 * Hide all toolbars AND disable editing (except for excluded node)
 * @param {HTMLElement} [excludeNode] - Node to keep active
 */
function hideAllToolbars(excludeNode = null) {
    document.querySelectorAll('.node-toolbar[data-visible="true"]').forEach(t => {
        const node = t.closest('.node');

        // Skip if this is the node we want to keep active
        if (excludeNode && node === excludeNode) return;

        t.dataset.visible = 'false';

        // Disable editing for this node
        if (node) {
            const content = node.querySelector('.node-content');
            if (content) content.setAttribute('contenteditable', 'false');
        }
    });

    // Safety check check: disable editing on other nodes (but NOT the excluded one)
    document.querySelectorAll('.node-content[contenteditable="true"]').forEach(el => {
        const node = el.closest('.node');
        if (excludeNode && node === excludeNode) return;

        el.setAttribute('contenteditable', 'false');
    });

    if (!excludeNode) {
        activeToolbar = null;
    }
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
 * Set font size - applies to SELECTED text or entire node
 */
/**
 * Set font size - applies to SELECTED text or entire node
 * @param {HTMLElement} nodeEl
 * @param {Object} nodeData
 * @param {number} size
 * @param {Range} [explicitRange] - Optional range to force selection
 */
function setNodeFontSize(nodeEl, nodeData, size, explicitRange = null) {
    const contentEl = nodeEl.querySelector('.node-content');
    const dropdown = nodeEl.querySelector('.font-size-dropdown');

    // Use explicit range if provided, otherwise current selection
    let range = explicitRange;
    let hasSelection = !!explicitRange;

    if (!hasSelection) {
        const selection = window.getSelection();
        hasSelection = selection &&
            selection.rangeCount > 0 &&
            !selection.isCollapsed &&
            contentEl.contains(selection.anchorNode);

        if (hasSelection) {
            range = selection.getRangeAt(0);
        }
    }

    // Safety check: verify range is actually within contentEl
    if (hasSelection && range) {
        if (!contentEl.contains(range.commonAncestorContainer) && range.commonAncestorContainer !== contentEl) {
            hasSelection = false;
        }
    }

    if (hasSelection && range) {
        // Apply font size to SELECTED text only using a span

        // Create a span with the new font size
        const span = document.createElement('span');
        span.style.fontSize = `${size}px`;

        // Extract selection and wrap in span
        try {
            const fragment = range.extractContents();
            span.appendChild(fragment);
            range.insertNode(span);

            // Re-select the text
            const selection = window.getSelection();
            selection.removeAllRanges();
            const newRange = document.createRange();
            newRange.selectNodeContents(span);
            selection.addRange(newRange);
        } catch (e) {
            // Fallback: apply to entire node
            console.error('Font resize error', e);
            contentEl.style.fontSize = `${size}px`;
        }
    } else {
        // No selection = apply to entire node
        contentEl.style.fontSize = `${size}px`;
        // Also save as default for this node
        updateNodeField(nodeData.id, 'fontSize', size);
    }

    // Update button display handled by inputs


    // Update active state
    dropdown.querySelectorAll('.font-size-option').forEach(opt => {
        opt.classList.toggle('active', parseInt(opt.dataset.size) === size);
    });

    // Update connections (node size may have changed)
    updateConnections(currentMap);
}

/**
 * Apply text style to selected text
 */
function applyTextStyle(style) {
    document.execCommand(style, false, null);
}

/**
 * Update toolbar button states based on current selection
 * Shows if text is bold, italic, underlined, and its font size
 */
function updateToolbarState(toolbar, contentEl) {
    if (!toolbar) return;

    // Check formatting state using queryCommandState
    const isBold = document.queryCommandState('bold');
    const isItalic = document.queryCommandState('italic');
    const isUnderline = document.queryCommandState('underline');

    // Update button active states
    const boldBtn = toolbar.querySelector('[data-action="bold"]');
    const italicBtn = toolbar.querySelector('[data-action="italic"]');
    const underlineBtn = toolbar.querySelector('[data-action="underline"]');

    boldBtn?.classList.toggle('active', isBold);
    italicBtn?.classList.toggle('active', isItalic);
    underlineBtn?.classList.toggle('active', isUnderline);

    // Try to get font size of current selection
    const selection = window.getSelection();
    if (selection.rangeCount > 0 && !selection.isCollapsed) {
        const range = selection.getRangeAt(0);
        let container = range.commonAncestorContainer;

        // Get the element (not text node)
        if (container.nodeType === Node.TEXT_NODE) {
            container = container.parentElement;
        }

        // Find font size
        const fontSize = window.getComputedStyle(container).fontSize;
        const sizeNum = parseInt(fontSize);

        // Update font size INPUT
        const fontInput = toolbar.querySelector('.font-size-input');
        if (fontInput && sizeNum) {
            fontInput.value = sizeNum;
        }
    }
}

/**
 * Start dragging a node
 */
function startDrag(e, nodeEl, nodeData) {
    // Cancel any existing drag first
    if (dragState) {
        const prevEl = document.getElementById(dragState.nodeId);
        prevEl?.classList.remove('dragging');
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

    const onMouseMove = (moveEvent) => {
        if (!dragState) return;

        // ALWAYS get the element by ID to avoid stale references
        const el = document.getElementById(dragState.nodeId);
        if (!el) return;

        const { scale } = window.canvasTransform || { scale: 1 };
        const dx = (moveEvent.clientX - dragState.startX) / scale;
        const dy = (moveEvent.clientY - dragState.startY) / scale;

        const newX = dragState.nodeStartX + dx;
        const newY = dragState.nodeStartY + dy;

        el.style.left = `${newX}px`;
        el.style.top = `${newY}px`;

        updateConnections(currentMap);
    };

    const onMouseUp = (upEvent) => {
        if (!dragState) return;

        // ALWAYS get the element by ID
        const el = document.getElementById(dragState.nodeId);

        const { scale } = window.canvasTransform || { scale: 1 };
        const dx = (upEvent.clientX - dragState.startX) / scale;
        const dy = (upEvent.clientY - dragState.startY) / scale;

        const newX = dragState.nodeStartX + dx;
        const newY = dragState.nodeStartY + dy;

        updateNodeField(dragState.nodeId, 'x', Math.round(newX));
        updateNodeField(dragState.nodeId, 'y', Math.round(newY));

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
 * If dropped on empty space, can delete existing connections
 */
function startConnection(fromNodeId) {
    const container = document.getElementById('canvas-container');
    container.classList.add('connecting');

    // Import and start preview
    import('./connections.js').then(({ startConnectionPreview, endConnectionPreview, deleteConnectionsFromNode }) => {
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
            // Dropped on empty space - could delete connections (optional feature)
            // For now, just cancel the operation

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
