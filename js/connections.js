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

    // Clear existing connections (wrappers)
    const existingConnections = connectionsLayer.querySelectorAll('.connection-wrapper');
    existingConnections.forEach(wrapper => wrapper.remove());

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

    const pathData = createBezierPath(fromAnchor, toAnchor);

    // Create a group for the connection to host the invisible 'hit area' and the visible path
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute('class', 'connection-wrapper');
    group.setAttribute('id', conn.id);
    group.setAttribute('data-from', conn.from);
    group.setAttribute('data-to', conn.to);

    // 1. HIT AREA: Invisible thick path for easy interaction
    const hitArea = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    hitArea.setAttribute('class', 'connection-hit-area');
    hitArea.setAttribute('d', pathData);
    group.appendChild(hitArea);

    // 2. VISIBLE PATH: The actual line the user sees
    const visiblePath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    visiblePath.setAttribute('class', 'connection-path');
    visiblePath.setAttribute('d', pathData);
    group.appendChild(visiblePath);

    // INTERACTION LOGIC
    const handleEnter = () => {
        group.classList.add('highlighted');
        showDeleteHint(conn.id);
    };
    const handleLeave = () => {
        group.classList.remove('highlighted');
        hideDeleteHint();
    };

    group.addEventListener('mouseenter', handleEnter);
    group.addEventListener('mouseleave', handleLeave);

    // Right-click to delete
    group.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        hideDeleteHint();
        deleteConnection(conn.id);
    });

    return group;
}

/**
 * Show a small floating hint for deletion
 */
let currentHint = null;
function showDeleteHint(connId) {
    if (currentHint) currentHint.remove();

    currentHint = document.createElement('div');
    currentHint.className = 'connection-delete-hint';
    // Only scissors icon, no text
    currentHint.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/>
            <line x1="20" y1="4" x2="8.12" y2="15.88"/>
            <line x1="14.47" y1="14.48" x2="20" y2="20"/>
            <line x1="8.12" y1="8.12" x2="12" y2="12"/>
        </svg>
    `;
    document.body.appendChild(currentHint);

    const onMove = (e) => {
        if (!currentHint) {
            document.removeEventListener('mousemove', onMove);
            return;
        }
        // Offset slightly to float near cursor
        currentHint.style.left = `${e.clientX + 12}px`;
        currentHint.style.top = `${e.clientY + 12}px`;
    };
    document.addEventListener('mousemove', onMove);
}

function hideDeleteHint() {
    if (currentHint) {
        currentHint.remove();
        currentHint = null;
    }
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

    const group = connectionsLayer?.querySelector(`#${connectionId}`);
    group?.remove();

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
    const wrappers = connectionsLayer?.querySelectorAll('.connection-wrapper');
    wrappers?.forEach(wrapper => {
        if (wrapper.dataset.from === nodeId || wrapper.dataset.to === nodeId) {
            wrapper.classList.add('highlighted');
        }
    });
}

/**
 * Clear all connection highlights
 */
export function clearConnectionHighlights() {
    const wrappers = connectionsLayer?.querySelectorAll('.connection-wrapper.highlighted');
    wrappers?.forEach(wrapper => {
        wrapper.classList.remove('highlighted');
    });
}
