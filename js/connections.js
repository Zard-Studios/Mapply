/**
 * connections.js – SVG curve connections between nodes
 * React Flow style: Uses SCREEN SPACE coordinates (getBoundingClientRect)
 * 
 * Features:
 * - Connects to NODE EDGES (not centers)
 * - Click to delete connections
 * - Live preview during connection creation
 */

let connectionsLayer = null;
let canvasContainer = null;
let currentMap = null;
let onConnectionDelete = null;

// Preview connection state
let previewPath = null;
let previewStartNodeId = null;

/**
 * Initialize connections module
 * @param {Object} options - { onConnectionDelete: function }
 */
export function initConnections(options = {}) {
    connectionsLayer = document.getElementById('connections-layer');
    canvasContainer = document.getElementById('canvas-container');
    onConnectionDelete = options.onConnectionDelete;
}

/**
 * Set the current map reference (for delete operations)
 */
export function setConnectionsMap(map) {
    currentMap = map;
}

/**
 * Update all connections based on current DOM node positions
 * Uses getBoundingClientRect for SCREEN SPACE coordinates
 * @param {Object} map - Current map data (for connection list only)
 */
export function updateConnections(map) {
    if (!connectionsLayer || !map || !canvasContainer) return;

    currentMap = map;

    // Clear existing paths (but keep preview)
    const existingPaths = connectionsLayer.querySelectorAll('.connection-path:not(.preview)');
    existingPaths.forEach(path => path.remove());

    // Get canvas container bounds for relative positioning
    const containerRect = canvasContainer.getBoundingClientRect();

    // Draw each connection
    map.connections.forEach(conn => {
        const path = createConnectionPath(conn, containerRect);
        if (path) {
            connectionsLayer.appendChild(path);
        }
    });
}

/**
 * Create an SVG path element for a connection
 * Connects to NODE EDGES (not centers)
 * @param {Object} conn - Connection data
 * @param {DOMRect} containerRect - Canvas container bounding rect
 * @returns {SVGPathElement|null}
 */
function createConnectionPath(conn, containerRect) {
    const fromEl = document.getElementById(conn.from);
    const toEl = document.getElementById(conn.to);

    if (!fromEl || !toEl) return null;

    // Get SCREEN positions using getBoundingClientRect
    const fromRect = fromEl.getBoundingClientRect();
    const toRect = toEl.getBoundingClientRect();

    // Calculate centers
    const fromCenter = {
        x: fromRect.left + fromRect.width / 2 - containerRect.left,
        y: fromRect.top + fromRect.height / 2 - containerRect.top
    };

    const toCenter = {
        x: toRect.left + toRect.width / 2 - containerRect.left,
        y: toRect.top + toRect.height / 2 - containerRect.top
    };

    // Calculate EDGE points (FigJam style: snap to side centers)
    const fromAnchor = getAnchorPoint(fromRect, toRect, containerRect);
    const toAnchor = getAnchorPoint(toRect, fromRect, containerRect);

    // Create smooth Bezier curve from anchor to anchor
    const d = createBezierPath(fromAnchor, toAnchor);

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('class', 'connection-path');
    path.setAttribute('d', d);
    path.setAttribute('data-from', conn.from);
    path.setAttribute('data-to', conn.to);
    path.setAttribute('id', conn.id);

    // Hover effect
    path.addEventListener('mouseenter', () => {
        path.classList.add('highlighted');
    });

    path.addEventListener('mouseleave', () => {
        path.classList.remove('highlighted');
    });

    // Right-click to delete connection
    path.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        deleteConnection(conn.id);
    });

    return path;
}

/**
 * Calculate the anchor point (center of one of the 4 sides)
 * @param {DOMRect} nodeRect - The node to get anchor from
 * @param {DOMRect} targetRect - The node/point we are connecting to
 * @param {DOMRect} containerRect - Canvas container for offset
 * @returns {Object} {x, y, side}
 */
function getAnchorPoint(nodeRect, targetRect, containerRect) {
    const from = {
        cx: nodeRect.left + nodeRect.width / 2 - containerRect.left,
        cy: nodeRect.top + nodeRect.height / 2 - containerRect.top,
        w: nodeRect.width,
        h: nodeRect.height
    };

    // Target can be a rect or just a point (for preview)
    const to = targetRect.left !== undefined ? {
        cx: targetRect.left + targetRect.width / 2 - containerRect.left,
        cy: targetRect.top + targetRect.height / 2 - containerRect.top
    } : {
        cx: targetRect.x,
        cy: targetRect.y
    };

    const dx = to.cx - from.cx;
    const dy = to.cy - from.cy;

    // Which side is closest to the target?
    if (Math.abs(dx) > Math.abs(dy)) {
        // Horizontal connection (Left/Right)
        return {
            x: dx > 0 ? from.cx + from.w / 2 : from.cx - from.w / 2,
            y: from.cy,
            side: dx > 0 ? 'right' : 'left'
        };
    } else {
        // Vertical connection (Top/Bottom)
        return {
            x: from.cx,
            y: dy > 0 ? from.cy + from.h / 2 : from.cy - from.h / 2,
            side: dy > 0 ? 'bottom' : 'top'
        };
    }
}

/**
 * Create a smooth Bezier curve path between two anchor points
 * @param {Object} from - {x, y, side}
 * @param {Object} to - {x, y, side}
 * @returns {string} SVG path d attribute
 */
function createBezierPath(from, to) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Dynamic curvature based on distance
    const curvature = Math.min(distance * 0.35, 100);

    let cp1x = from.x;
    let cp1y = from.y;
    let cp2x = to.x;
    let cp2y = to.y;

    // Start point control
    if (from.side === 'left') cp1x -= curvature;
    else if (from.side === 'right') cp1x += curvature;
    else if (from.side === 'top') cp1y -= curvature;
    else if (from.side === 'bottom') cp1y += curvature;
    else {
        // Fallback if side is unknown (e.g. mouse position)
        cp1x += (dx > 0 ? curvature : -curvature);
    }

    // End point control
    if (to.side === 'left') cp2x -= curvature;
    else if (to.side === 'right') cp2x += curvature;
    else if (to.side === 'top') cp2y -= curvature;
    else if (to.side === 'bottom') cp2y += curvature;
    else {
        // Fallback for mouse position in preview
        cp2x -= (dx > 0 ? curvature : -curvature);
    }

    return `M ${from.x} ${from.y} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${to.x} ${to.y}`;
}

/**
 * Delete a connection
 */
function deleteConnection(connectionId) {
    if (!currentMap) return;

    const index = currentMap.connections.findIndex(c => c.id === connectionId);
    if (index === -1) return;

    currentMap.connections.splice(index, 1);

    const path = connectionsLayer?.querySelector(`#${connectionId}`);
    path?.remove();

    onConnectionDelete?.();
}

/**
 * Start connection preview (called when dragging from handle)
 * @param {string} fromNodeId - Source node ID
 */
export function startConnectionPreview(fromNodeId) {
    previewStartNodeId = fromNodeId;

    // Create preview path
    previewPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    previewPath.setAttribute('class', 'connection-path preview');
    previewPath.setAttribute('d', 'M 0 0');
    connectionsLayer.appendChild(previewPath);

    // Add mousemove listener
    document.addEventListener('mousemove', updateConnectionPreview);
}

/**
 * Update connection preview position
 */
function updateConnectionPreview(e) {
    if (!previewPath || !previewStartNodeId) return;

    const containerRect = canvasContainer.getBoundingClientRect();
    const fromEl = document.getElementById(previewStartNodeId);
    if (!fromEl) return;

    const fromRect = fromEl.getBoundingClientRect();
    const fromCenter = {
        x: fromRect.left + fromRect.width / 2 - containerRect.left,
        y: fromRect.top + fromRect.height / 2 - containerRect.top
    };

    const mousePos = {
        x: e.clientX - containerRect.left,
        y: e.clientY - containerRect.top
    };

    // Calculate anchor point
    const fromAnchor = getAnchorPoint(fromRect, mousePos, containerRect);

    const d = createBezierPath(fromAnchor, mousePos);
    previewPath.setAttribute('d', d);
}

/**
 * End connection preview
 */
export function endConnectionPreview() {
    document.removeEventListener('mousemove', updateConnectionPreview);
    previewPath?.remove();
    previewPath = null;
    previewStartNodeId = null;
}

/**
 * Remove a connection by ID
 */
export function removeConnection(connectionId) {
    const path = connectionsLayer?.querySelector(`#${connectionId}`);
    path?.remove();
}

/**
 * Highlight connections for a specific node
 */
export function highlightNodeConnections(nodeId) {
    const paths = connectionsLayer?.querySelectorAll('.connection-path');
    paths?.forEach(path => {
        if (path.dataset.from === nodeId || path.dataset.to === nodeId) {
            path.classList.add('highlighted');
        }
    });
}

/**
 * Clear all connection highlights
 */
export function clearConnectionHighlights() {
    const paths = connectionsLayer?.querySelectorAll('.connection-path.highlighted');
    paths?.forEach(path => {
        path.classList.remove('highlighted');
    });
}
