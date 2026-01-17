/**
 * connections.js – SVG curve connections between nodes
 * FigJam-style: connects from CENTER to CENTER
 * 
 * FIXED: SVG layer is NOT transformed - we calculate coordinates in SCREEN space
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
 * Calculates paths in SCREEN SPACE (accounts for pan/zoom)
 * @param {Object} map - Current map data (for connection list only)
 */
export function updateConnections(map) {
    if (!connectionsLayer || !map) return;

    // Clear existing paths
    const existingPaths = connectionsLayer.querySelectorAll('.connection-path');
    existingPaths.forEach(path => path.remove());

    // Get current transform
    const transform = window.canvasTransform || { scale: 1, offsetX: 0, offsetY: 0 };

    // Draw each connection
    map.connections.forEach(conn => {
        const path = createConnectionPath(conn, transform);
        if (path) {
            connectionsLayer.appendChild(path);
        }
    });
}

/**
 * Convert canvas coordinates to screen coordinates
 */
function canvasToScreen(canvasX, canvasY, transform) {
    return {
        x: canvasX * transform.scale + transform.offsetX,
        y: canvasY * transform.scale + transform.offsetY
    };
}

/**
 * Create an SVG path element for a connection
 * Uses SCREEN space coordinates
 * @param {Object} conn - Connection data
 * @param {Object} transform - Current canvas transform
 * @returns {SVGPathElement|null}
 */
function createConnectionPath(conn, transform) {
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
    const fromCenterCanvas = {
        x: fromX + fromRect.width / 2,
        y: fromY + fromRect.height / 2
    };

    const toCenterCanvas = {
        x: toX + toRect.width / 2,
        y: toY + toRect.height / 2
    };

    // Convert to SCREEN space
    const fromCenter = canvasToScreen(fromCenterCanvas.x, fromCenterCanvas.y, transform);
    const toCenter = canvasToScreen(toCenterCanvas.x, toCenterCanvas.y, transform);

    // Create smooth Bezier curve in screen space
    const d = createBezierPath(fromCenter, toCenter, transform.scale);

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('class', 'connection-path');
    path.setAttribute('d', d);
    path.setAttribute('data-from', conn.from);
    path.setAttribute('data-to', conn.to);
    path.setAttribute('id', conn.id);

    // Adjust stroke width for zoom (so it doesn't get too thin/thick)
    path.style.strokeWidth = `${Math.max(1.5, 2 * transform.scale)}px`;

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
 * Create a smooth Bezier curve path between two screen points
 * @param {Object} from - Start point (screen space)
 * @param {Object} to - End point (screen space)
 * @param {number} scale - Current zoom scale
 * @returns {string} SVG path d attribute
 */
function createBezierPath(from, to, scale) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Control point offset (adjusted for scale)
    const curvature = Math.min(distance * 0.5, 120 * scale);

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
