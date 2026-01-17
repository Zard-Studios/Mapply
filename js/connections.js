/**
 * connections.js – SVG curve connections between nodes
 * Uses Bezier curves for smooth, elegant lines
 */

let connectionsLayer = null;

/**
 * Initialize connections module
 */
export function initConnections() {
    connectionsLayer = document.getElementById('connections-layer');
}

/**
 * Update all connections based on current node positions
 * @param {Object} map - Current map data
 */
export function updateConnections(map) {
    if (!connectionsLayer || !map) return;

    // Clear existing paths (keep defs)
    const existingPaths = connectionsLayer.querySelectorAll('.connection-path');
    existingPaths.forEach(path => path.remove());

    // Draw each connection
    map.connections.forEach(conn => {
        const path = createConnectionPath(conn, map.nodes);
        if (path) {
            connectionsLayer.appendChild(path);
        }
    });
}

/**
 * Create an SVG path element for a connection
 * @param {Object} conn - Connection data
 * @param {Array} nodes - All nodes
 * @returns {SVGPathElement|null}
 */
function createConnectionPath(conn, nodes) {
    const fromNode = nodes.find(n => n.id === conn.from);
    const toNode = nodes.find(n => n.id === conn.to);

    if (!fromNode || !toNode) return null;

    // Get node elements to calculate actual dimensions
    const fromEl = document.getElementById(fromNode.id);
    const toEl = document.getElementById(toNode.id);

    if (!fromEl || !toEl) return null;

    // Get node centers
    const fromRect = {
        width: fromEl.offsetWidth,
        height: fromEl.offsetHeight
    };
    const toRect = {
        width: toEl.offsetWidth,
        height: toEl.offsetHeight
    };

    const fromCenter = {
        x: fromNode.x + fromRect.width / 2,
        y: fromNode.y + fromRect.height / 2
    };

    const toCenter = {
        x: toNode.x + toRect.width / 2,
        y: toNode.y + toRect.height / 2
    };

    // Calculate best connection points (edge of nodes)
    const fromPoint = getConnectionPoint(fromNode, fromRect, toCenter);
    const toPoint = getConnectionPoint(toNode, toRect, fromCenter);

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

    // Click to delete (optional)
    path.addEventListener('dblclick', () => {
        // Could implement connection deletion here
    });

    return path;
}

/**
 * Get the connection point on the edge of a node
 * @param {Object} node - Node data
 * @param {Object} rect - Node dimensions
 * @param {Object} target - Target point to connect towards
 * @returns {Object} { x, y }
 */
function getConnectionPoint(node, rect, target) {
    const centerX = node.x + rect.width / 2;
    const centerY = node.y + rect.height / 2;

    // Calculate angle to target
    const angle = Math.atan2(target.y - centerY, target.x - centerX);

    // Calculate intersection with node edge
    const halfWidth = rect.width / 2 + 6; // Add padding for handles
    const halfHeight = rect.height / 2 + 6;

    // Use rectangle edge intersection
    const tanAngle = Math.tan(angle);

    let x, y;

    // Check which edge the line intersects
    const yAtRightEdge = tanAngle * halfWidth;
    const yAtLeftEdge = -tanAngle * halfWidth;

    if (Math.abs(yAtRightEdge) <= halfHeight && target.x > centerX) {
        // Right edge
        x = centerX + halfWidth;
        y = centerY + yAtRightEdge;
    } else if (Math.abs(yAtLeftEdge) <= halfHeight && target.x < centerX) {
        // Left edge
        x = centerX - halfWidth;
        y = centerY + yAtLeftEdge;
    } else if (target.y > centerY) {
        // Bottom edge
        x = centerX + halfHeight / tanAngle;
        y = centerY + halfHeight;
    } else {
        // Top edge
        x = centerX - halfHeight / tanAngle;
        y = centerY - halfHeight;
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

    // Control point offset based on distance
    const curvature = Math.min(distance * 0.3, 100);

    // Determine control points based on direction
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
