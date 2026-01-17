/**
 * connections.js – SVG curve connections between nodes
 * FigJam-style: connects from CENTER to CENTER
 * 
 * FIXED: Uses CANVAS space coordinates + CSS Transform + non-scaling-stroke
 */

let connectionsLayer = null;

/**
 * Initialize connections module
 */
export function initConnections() {
    connectionsLayer = document.getElementById('connections-layer');
}

/**
 * Update all connections based on current DOM node positions
 * @param {Object} map - Current map data (for connection list only)
 */
export function updateConnections(map) {
    if (!connectionsLayer || !map) return;

    // Clear existing paths
    const existingPaths = connectionsLayer.querySelectorAll('.connection-path');
    existingPaths.forEach(path => path.remove());

    // Draw each connection
    map.connections.forEach(conn => {
        const path = createConnectionPath(conn);
        if (path) {
            connectionsLayer.appendChild(path);
        }
    });
}

/**
 * Create an SVG path element for a connection
 * Uses CANVAS space coordinates (CSS transform handles zoom)
 * @param {Object} conn - Connection data
 * @returns {SVGPathElement|null}
 */
function createConnectionPath(conn) {
    const fromEl = document.getElementById(conn.from);
    const toEl = document.getElementById(conn.to);

    if (!fromEl || !toEl) return null;

    // Read positions from DOM (canvas space)
    const fromX = parseFloat(fromEl.style.left) || 0;
    const fromY = parseFloat(fromEl.style.top) || 0;
    const toX = parseFloat(toEl.style.left) || 0;
    const toY = parseFloat(toEl.style.top) || 0;

    const fromRect = {
        width: fromEl.offsetWidth,
        height: fromEl.offsetHeight
    };
    const toRect = {
        width: toEl.offsetWidth,
        height: toEl.offsetHeight
    };

    // Calculate centers in CANVAS space
    const fromCenter = {
        x: fromX + fromRect.width / 2,
        y: fromY + fromRect.height / 2
    };

    const toCenter = {
        x: toX + toRect.width / 2,
        y: toY + toRect.height / 2
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
 * @param {Object} from - Start point
 * @param {Object} to - End point
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
