/**
 * connections.js – SVG curve connections between nodes
 * React Flow style: Uses SCREEN SPACE coordinates (getBoundingClientRect)
 * 
 * The SVG layer is NOT transformed - it stays fixed to the screen.
 * Connections are drawn using screen coordinates of the nodes.
 */

let connectionsLayer = null;
let canvasContainer = null;

/**
 * Initialize connections module
 */
export function initConnections() {
    connectionsLayer = document.getElementById('connections-layer');
    canvasContainer = document.getElementById('canvas-container');
}

/**
 * Update all connections based on current DOM node positions
 * Uses getBoundingClientRect for SCREEN SPACE coordinates
 * @param {Object} map - Current map data (for connection list only)
 */
export function updateConnections(map) {
    if (!connectionsLayer || !map || !canvasContainer) return;

    // Clear existing paths
    const existingPaths = connectionsLayer.querySelectorAll('.connection-path');
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
 * Uses SCREEN SPACE coordinates (relative to canvas container)
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

    // Calculate centers in SCREEN space, relative to canvas container
    const fromCenter = {
        x: fromRect.left + fromRect.width / 2 - containerRect.left,
        y: fromRect.top + fromRect.height / 2 - containerRect.top
    };

    const toCenter = {
        x: toRect.left + toRect.width / 2 - containerRect.left,
        y: toRect.top + toRect.height / 2 - containerRect.top
    };

    // Create smooth Bezier curve
    const d = createBezierPath(fromCenter, toCenter);

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('class', 'connection-path');
    path.setAttribute('d', d);
    path.setAttribute('data-from', conn.from);
    path.setAttribute('data-to', conn.to);
    path.setAttribute('id', conn.id);

    // Add hover effect
    path.addEventListener('mouseenter', () => {
        path.classList.add('highlighted');
    });

    path.addEventListener('mouseleave', () => {
        path.classList.remove('highlighted');
    });

    return path;
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
    const curvature = Math.min(distance * 0.5, 120);

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
