/**
 * connections.js – SVG curve connections between nodes
 * Uses Bezier curves for smooth, elegant lines
 * FIXED: Now reads positions directly from DOM for real-time updates
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

    // Clear existing paths (keep defs)
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
 * Reads positions directly from DOM elements for accuracy
 * @param {Object} conn - Connection data
 * @returns {SVGPathElement|null}
 */
function createConnectionPath(conn) {
    const fromEl = document.getElementById(conn.from);
    const toEl = document.getElementById(conn.to);

    if (!fromEl || !toEl) return null;

    // Read actual positions from DOM (not from data)
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

    // Calculate centers
    const fromCenter = {
        x: fromX + fromRect.width / 2,
        y: fromY + fromRect.height / 2
    };

    const toCenter = {
        x: toX + toRect.width / 2,
        y: toY + toRect.height / 2
    };

    // Get edge connection points
    const fromPoint = getEdgePoint(fromX, fromY, fromRect, toCenter);
    const toPoint = getEdgePoint(toX, toY, toRect, fromCenter);

    // Create Bezier curve path
    const d = createBezierPath(fromPoint, toPoint);

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
 * Get the connection point on the edge of a node
 * @param {number} nodeX - Node X position
 * @param {number} nodeY - Node Y position
 * @param {Object} rect - Node dimensions
 * @param {Object} target - Target point to connect towards
 * @returns {Object} { x, y }
 */
function getEdgePoint(nodeX, nodeY, rect, target) {
    const centerX = nodeX + rect.width / 2;
    const centerY = nodeY + rect.height / 2;

    const dx = target.x - centerX;
    const dy = target.y - centerY;

    // If target is at the same position, return center
    if (dx === 0 && dy === 0) {
        return { x: centerX, y: centerY };
    }

    const halfWidth = rect.width / 2;
    const halfHeight = rect.height / 2;

    // Calculate intersection with rectangle edge
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    let x, y;

    // Check if the line exits through left/right or top/bottom
    if (absDx * halfHeight > absDy * halfWidth) {
        // Exits through left or right
        x = centerX + halfWidth * Math.sign(dx);
        y = centerY + (halfWidth * dy) / absDx;
    } else {
        // Exits through top or bottom
        x = centerX + (halfHeight * dx) / absDy;
        y = centerY + halfHeight * Math.sign(dy);
    }

    return { x, y };
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

    // Control point offset based on distance (smoother curves)
    const curvature = Math.min(distance * 0.4, 80);

    let cp1x, cp1y, cp2x, cp2y;

    if (Math.abs(dx) > Math.abs(dy)) {
        // Horizontal-ish connection
        cp1x = from.x + curvature * Math.sign(dx);
        cp1y = from.y;
        cp2x = to.x - curvature * Math.sign(dx);
        cp2y = to.y;
    } else {
        // Vertical-ish connection
        cp1x = from.x;
        cp1y = from.y + curvature * Math.sign(dy);
        cp2x = to.x;
        cp2y = to.y - curvature * Math.sign(dy);
    }

    return `M ${from.x} ${from.y} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${to.x} ${to.y}`;
}

/**
 * Remove a connection by ID
 * @param {string} connectionId
 */
export function removeConnection(connectionId) {
    const path = connectionsLayer?.querySelector(`#${connectionId}`);
    path?.remove();
}

/**
 * Highlight connections for a specific node
 * @param {string} nodeId
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
