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

    // Calculate EDGE points (where the line actually touches the node border)
    const fromEdge = getEdgePoint(fromCenter, toCenter, fromRect, containerRect);
    const toEdge = getEdgePoint(toCenter, fromCenter, toRect, containerRect);

    // Create smooth Bezier curve from edge to edge
    const d = createBezierPath(fromEdge, toEdge);

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

    // Click to delete
    path.addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm('Eliminare questo collegamento?')) {
            deleteConnection(conn.id);
        }
    });

    return path;
}

/**
 * Calculate the point where a line from center to target intersects the node border
 * @param {Object} center - Center point of this node
 * @param {Object} target - Target point (center of other node)
 * @param {DOMRect} nodeRect - Bounding rect of this node
 * @param {DOMRect} containerRect - Container rect for offset
 * @returns {Object} Edge point {x, y}
 */
function getEdgePoint(center, target, nodeRect, containerRect) {
    const dx = target.x - center.x;
    const dy = target.y - center.y;

    if (dx === 0 && dy === 0) return center;

    // Node dimensions in screen space
    const halfWidth = (nodeRect.width / 2);
    const halfHeight = (nodeRect.height / 2);

    // Calculate intersection with node border
    const angle = Math.atan2(dy, dx);

    // Check which edge we intersect
    const tanAngle = Math.abs(dy / (dx || 0.001));
    const aspectRatio = halfHeight / halfWidth;

    let edgeX, edgeY;

    if (tanAngle < aspectRatio) {
        // Intersects left or right edge
        edgeX = dx > 0 ? halfWidth : -halfWidth;
        edgeY = edgeX * Math.tan(angle);
    } else {
        // Intersects top or bottom edge
        edgeY = dy > 0 ? halfHeight : -halfHeight;
        edgeX = edgeY / Math.tan(angle);
    }

    // Add small padding from edge
    const padding = 4;
    const length = Math.sqrt(edgeX * edgeX + edgeY * edgeY);
    const scale = (length - padding) / length;

    return {
        x: center.x + edgeX * scale,
        y: center.y + edgeY * scale
    };
}

/**
 * Create a smooth Bezier curve path between two points
 * @param {Object} from - Start point (screen space)
 * @param {Object} to - End point (screen space)
 * @returns {string} SVG path d attribute
 */
function createBezierPath(from, to) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Control point offset
    const curvature = Math.min(distance * 0.4, 80);

    let cp1x, cp1y, cp2x, cp2y;

    if (Math.abs(dy) > Math.abs(dx) * 0.5) {
        // Primarily vertical
        cp1x = from.x;
        cp1y = from.y + curvature * Math.sign(dy);
        cp2x = to.x;
        cp2y = to.y - curvature * Math.sign(dy);
    } else {
        // Primarily horizontal
        cp1x = from.x + curvature * Math.sign(dx);
        cp1y = from.y;
        cp2x = to.x - curvature * Math.sign(dx);
        cp2y = to.y;
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

    // Calculate edge point
    const fromEdge = getEdgePoint(fromCenter, mousePos, fromRect, containerRect);

    const d = createBezierPath(fromEdge, mousePos);
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
