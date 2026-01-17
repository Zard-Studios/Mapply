/**
 * nodes.js – Node creation, management, and interactions
 * Handles drag & drop, selection, and editing
 */

import { createNode, createConnection, MAX_SECONDARY_NODES } from './schema.js';
import { screenToCanvas } from './canvas.js';
import { updateConnections } from './connections.js';

// State
let nodesLayer = null;
let currentMap = null;
let selectedNodeId = null;
let dragState = null;

// Callbacks
let onNodeChange = null;
let onConnectionCreate = null;

// SVG Icons for nodes
const NODE_ICONS = {
    star: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
    lightning: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
    book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>',
    link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>',
    lightbulb: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14"/></svg>'
};

/**
 * Initialize nodes module
 * @param {Object} map - Current map data
 * @param {Object} options - Callbacks
 */
export function initNodes(map, options = {}) {
    nodesLayer = document.getElementById('nodes-layer');
    currentMap = map;
    onNodeChange = options.onNodeChange;
    onConnectionCreate = options.onConnectionCreate;

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
    node.dataset.color = nodeData.color;
    node.style.left = `${nodeData.x}px`;
    node.style.top = `${nodeData.y}px`;

    node.innerHTML = `
    <div class="node-actions">
      <button class="node-action-btn delete" aria-label="Elimina nodo" title="Elimina">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
        </svg>
      </button>
    </div>
    <div class="node-header">
      <div class="node-icon">${NODE_ICONS[nodeData.icon] || NODE_ICONS.star}</div>
      <div class="node-title" contenteditable="true" spellcheck="false">${escapeHtml(nodeData.title)}</div>
    </div>
    <div class="node-text" contenteditable="true" spellcheck="false">${escapeHtml(nodeData.text)}</div>
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
    // Selection
    nodeEl.addEventListener('mousedown', (e) => {
        if (e.target.closest('.node-action-btn') || e.target.closest('.node-handle')) return;
        if (e.target.contentEditable === 'true') return;

        selectNode(nodeData.id);
        startDrag(e, nodeEl, nodeData);
    });

    // Delete button
    nodeEl.querySelector('.node-action-btn.delete')?.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteNode(nodeData.id);
    });

    // Title editing
    const titleEl = nodeEl.querySelector('.node-title');
    titleEl.addEventListener('blur', () => {
        updateNodeField(nodeData.id, 'title', titleEl.textContent.trim() || 'Senza titolo');
    });
    titleEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            titleEl.blur();
        }
    });

    // Text editing
    const textEl = nodeEl.querySelector('.node-text');
    textEl.addEventListener('blur', () => {
        updateNodeField(nodeData.id, 'text', textEl.textContent.trim());
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
 * Start dragging a node
 */
function startDrag(e, nodeEl, nodeData) {
    dragState = {
        nodeId: nodeData.id,
        startX: e.clientX,
        startY: e.clientY,
        nodeStartX: nodeData.x,
        nodeStartY: nodeData.y
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

        // Update connections
        updateConnections(currentMap);
    };

    const onMouseUp = () => {
        if (!dragState) return;

        const { scale } = window.canvasTransform || { scale: 1 };
        const dx = (event.clientX - dragState.startX) / scale;
        const dy = (event.clientY - dragState.startY) / scale;

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
 */
export function addNodeAtCenter() {
    if (!currentMap) return;

    // Check secondary node limit
    const secondaryCount = currentMap.nodes.filter(n => n.type === 'secondary').length;
    const hasMain = currentMap.nodes.some(n => n.type === 'main');

    // Determine node type
    const type = !hasMain ? 'main' : 'secondary';

    if (type === 'secondary' && secondaryCount >= MAX_SECONDARY_NODES) {
        window.showToast?.(`Massimo ${MAX_SECONDARY_NODES} nodi secondari`, 'warning');
        return;
    }

    // Get canvas center
    const container = document.getElementById('canvas-container');
    const rect = container.getBoundingClientRect();
    const center = screenToCanvas(
        rect.left + rect.width / 2,
        rect.top + rect.height / 2
    );

    // Create node
    const node = createNode({
        type,
        title: type === 'main' ? 'Concetto principale' : 'Nuovo concetto',
        x: Math.round(center.x),
        y: Math.round(center.y),
        color: ['purple', 'blue', 'green', 'orange', 'pink'][currentMap.nodes.length % 5]
    });

    // Add to map
    currentMap.nodes.push(node);

    // Render and select
    renderNode(node);
    selectNode(node.id);

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
let tempConnection = null;

function startConnection(fromNodeId, fromHandle) {
    const fromNode = currentMap.nodes.find(n => n.id === fromNodeId);
    if (!fromNode) return;

    const container = document.getElementById('canvas-container');
    container.classList.add('connecting');

    tempConnection = {
        fromId: fromNodeId,
        fromHandle
    };

    const onMouseMove = (e) => {
        // Draw temporary connection line (handled in connections.js)
    };

    const onMouseUp = (e) => {
        container.classList.remove('connecting');

        // Check if dropped on another node's handle
        const target = e.target.closest('.node-handle');
        if (target) {
            const toNodeEl = target.closest('.node');
            if (toNodeEl && toNodeEl.id !== fromNodeId) {
                // Create connection
                createNodeConnection(fromNodeId, toNodeEl.id);
            }
        }

        tempConnection = null;
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
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

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
