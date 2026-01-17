/**
 * nodes.js – Node creation, management, and interactions
 * Handles drag & drop, selection, and editing
 * 
 * SIMPLIFIED: Removed icons, color borders, title requirement
 * Added: Text styling (bold, italic, underline)
 */

import { createNode, createConnection } from './schema.js';
import { screenToCanvas } from './canvas.js';
import { updateConnections } from './connections.js';

// State
let nodesLayer = null;
let currentMap = null;
let selectedNodeId = null;
let dragState = null;

// Callbacks
let onNodeChange = null;

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

    // Simplified node HTML - no icons, no color border
    node.innerHTML = `
    <div class="node-actions">
      <button class="node-action-btn style-btn" data-style="bold" aria-label="Grassetto" title="Grassetto (Ctrl+B)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/><path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/>
        </svg>
      </button>
      <button class="node-action-btn style-btn" data-style="italic" aria-label="Corsivo" title="Corsivo (Ctrl+I)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="19" y1="4" x2="10" y2="4"/><line x1="14" y1="20" x2="5" y2="20"/><line x1="15" y1="4" x2="9" y2="20"/>
        </svg>
      </button>
      <button class="node-action-btn style-btn" data-style="underline" aria-label="Sottolineato" title="Sottolineato (Ctrl+U)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M6 3v7a6 6 0 0 0 6 6 6 6 0 0 0 6-6V3"/><line x1="4" y1="21" x2="20" y2="21"/>
        </svg>
      </button>
      <button class="node-action-btn delete" aria-label="Elimina nodo" title="Elimina">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
        </svg>
      </button>
    </div>
    <div class="node-content" contenteditable="true" spellcheck="false" data-placeholder="Scrivi qui...">${nodeData.content || ''}</div>
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
    // Selection and drag start
    nodeEl.addEventListener('mousedown', (e) => {
        if (e.target.closest('.node-action-btn') || e.target.closest('.node-handle')) return;

        // Allow clicking into contenteditable
        if (e.target.contentEditable === 'true') {
            selectNode(nodeData.id);
            return;
        }

        selectNode(nodeData.id);
        startDrag(e, nodeEl, nodeData);
    });

    // Delete button
    nodeEl.querySelector('.node-action-btn.delete')?.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteNode(nodeData.id);
    });

    // Text styling buttons
    nodeEl.querySelectorAll('.style-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const style = btn.dataset.style;
            applyTextStyle(style);
        });
    });

    // Content editing
    const contentEl = nodeEl.querySelector('.node-content');
    contentEl.addEventListener('input', () => {
        updateNodeField(nodeData.id, 'content', contentEl.innerHTML);
    });

    // Keyboard shortcuts for text styling
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
            startConnection(nodeData.id, handle.dataset.handle);
        });
    });
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

        // Update node position visually
        nodeEl.style.left = `${newX}px`;
        nodeEl.style.top = `${newY}px`;

        // Update connections in real-time (reads from DOM)
        updateConnections(currentMap);
    };

    const onMouseUp = (upEvent) => {
        if (!dragState) return;

        const { scale } = window.canvasTransform || { scale: 1 };
        const dx = (upEvent.clientX - dragState.startX) / scale;
        const dy = (upEvent.clientY - dragState.startY) / scale;

        const newX = dragState.nodeStartX + dx;
        const newY = dragState.nodeStartY + dy;

        // Update data
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
    // Deselect previous
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
 * NO LIMIT on number of nodes
 */
export function addNodeAtCenter() {
    if (!currentMap) return;

    // Get canvas center
    const container = document.getElementById('canvas-container');
    const rect = container.getBoundingClientRect();
    const center = screenToCanvas(
        rect.left + rect.width / 2,
        rect.top + rect.height / 2
    );

    // Determine type based on whether there's already a main node
    const hasMain = currentMap.nodes.some(n => n.type === 'main');
    const type = !hasMain ? 'main' : 'secondary';

    // Create node (no title requirement, just content)
    const node = createNode({
        type,
        content: '',
        x: Math.round(center.x),
        y: Math.round(center.y)
    });

    // Add to map
    currentMap.nodes.push(node);

    // Render and select
    renderNode(node);
    selectNode(node.id);

    // Focus the content for immediate editing
    setTimeout(() => {
        const contentEl = document.querySelector(`#${node.id} .node-content`);
        contentEl?.focus();
    }, 50);

    // Notify change
    onNodeChange?.();
}

/**
 * Delete a node
 */
export function deleteNode(nodeId) {
    if (!currentMap) return;

    // Remove from nodes array
    const index = currentMap.nodes.findIndex(n => n.id === nodeId);
    if (index === -1) return;

    currentMap.nodes.splice(index, 1);

    // Remove all connections involving this node
    currentMap.connections = currentMap.connections.filter(
        c => c.from !== nodeId && c.to !== nodeId
    );

    // Remove from DOM
    document.getElementById(nodeId)?.remove();

    // Clear selection
    if (selectedNodeId === nodeId) {
        selectedNodeId = null;
    }

    // Update connections
    updateConnections(currentMap);

    // Notify change
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
 * Start creating a connection
 */
function startConnection(fromNodeId, fromHandle) {
    const container = document.getElementById('canvas-container');
    container.classList.add('connecting');

    const onMouseUp = (e) => {
        container.classList.remove('connecting');

        // Check if dropped on another node's handle
        const target = e.target.closest('.node-handle');
        if (target) {
            const toNodeEl = target.closest('.node');
            if (toNodeEl && toNodeEl.id !== fromNodeId) {
                createNodeConnection(fromNodeId, toNodeEl.id);
            }
        }

        document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mouseup', onMouseUp);
}

/**
 * Create a connection between two nodes
 */
function createNodeConnection(fromId, toId) {
    if (!currentMap) return;

    // Check if connection already exists
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
