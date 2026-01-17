/**
 * canvas.js – Infinite canvas with pan and zoom
 * Manages the viewport transformation
 */

// Canvas state
let canvasContainer = null;
let viewport = null;
let nodesLayer = null;
let connectionsLayer = null;

// Transform state
let scale = 1;
let offsetX = 0;
let offsetY = 0;

// Interaction state
let isPanning = false;
let panStartX = 0;
let panStartY = 0;
let isSpacePressed = false; // Spacebar held = pan mode

// Zoom limits
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 2;
const ZOOM_STEP = 0.1;

// Callbacks
let onTransformChange = null;

/**
 * Initialize the canvas
 * @param {Object} options - Configuration options
 */
export function initCanvas(options = {}) {
    canvasContainer = document.getElementById('canvas-container');
    viewport = document.getElementById('viewport'); // Get viewport
    nodesLayer = document.getElementById('nodes-layer');
    connectionsLayer = document.getElementById('connections-layer');

    // CRITICAL for zoom sync
    if (viewport) {
        viewport.style.transformOrigin = '0 0';
    }

    if (options.onTransformChange) {
        onTransformChange = options.onTransformChange;
    }

    // Setup event listeners
    setupPanning();
    setupZoom();
    setupKeyboardShortcuts();
    setupDoubleClick();

    // Initial transform
    applyTransform();
    updateZoomDisplay();
}

/**
 * Setup panning with mouse and touch
 */
function setupPanning() {
    // Spacebar key handlers for pan mode (like Figma)
    document.addEventListener('keydown', (e) => {
        if (e.code === 'Space' && !e.repeat && !isEditingText()) {
            isSpacePressed = true;
            window.isSpacePanMode = true; // Expose for nodes.js
            canvasContainer.style.cursor = 'grab';
            e.preventDefault();
        }
    });

    document.addEventListener('keyup', (e) => {
        if (e.code === 'Space') {
            isSpacePressed = false;
            window.isSpacePanMode = false; // Expose for nodes.js
            canvasContainer.style.cursor = '';
        }
    });

    // Mouse panning - SIMPLE: click anywhere that's NOT a node
    canvasContainer.addEventListener('mousedown', (e) => {
        // Only left mouse button
        if (e.button !== 0) return;

        // If clicking on a node or its children, don't pan
        if (e.target.closest('.node')) return;

        // If clicking on toolbar or similar UI, don't pan
        if (e.target.closest('.node-toolbar')) return;
        if (e.target.closest('.font-size-dropdown')) return;

        // Check for Box Selection Modifier (Ctrl or Cmd)
        if (e.ctrlKey || e.metaKey) {
            import('./nodes.js').then(({ startSelectionBox }) => {
                startSelectionBox(e);
            });
            return;
        }

        // Otherwise, START PANNING!
        startPan(e.clientX, e.clientY);
        e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
        if (isPanning) {
            pan(e.clientX, e.clientY);
        }
    });

    document.addEventListener('mouseup', () => {
        endPan();
        if (isSpacePressed) {
            canvasContainer.style.cursor = 'grab';
        }
    });

    // Touch panning (two-finger)
    let lastTouchDistance = 0;
    let lastTouchCenter = { x: 0, y: 0 };

    canvasContainer.addEventListener('touchstart', (e) => {
        if (e.touches.length === 2) {
            // Pinch zoom start
            lastTouchDistance = getTouchDistance(e.touches);
            lastTouchCenter = getTouchCenter(e.touches);
        } else if (e.touches.length === 1 && e.target === canvasContainer) {
            startPan(e.touches[0].clientX, e.touches[0].clientY);
        }
    }, { passive: true });

    canvasContainer.addEventListener('touchmove', (e) => {
        if (e.touches.length === 2) {
            // Pinch zoom
            const distance = getTouchDistance(e.touches);
            const center = getTouchCenter(e.touches);
            const delta = distance - lastTouchDistance;

            if (Math.abs(delta) > 5) {
                const zoomDelta = delta > 0 ? ZOOM_STEP : -ZOOM_STEP;
                zoomAt(center.x, center.y, zoomDelta);
                lastTouchDistance = distance;
            }

            lastTouchCenter = center;
        } else if (e.touches.length === 1 && isPanning) {
            pan(e.touches[0].clientX, e.touches[0].clientY);
        }
    }, { passive: true });

    canvasContainer.addEventListener('touchend', () => {
        endPan();
    });
}

/**
 * Check if user is editing text (don't trigger spacebar pan)
 */
function isEditingText() {
    const el = document.activeElement;
    return el && (el.isContentEditable || el.tagName === 'INPUT' || el.tagName === 'TEXTAREA');
}

/**
 * Setup zoom with scroll wheel
 */
function setupZoom() {
    canvasContainer.addEventListener('wheel', (e) => {
        e.preventDefault();

        const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
        zoomAt(e.clientX, e.clientY, delta);
    }, { passive: false });

    // Zoom buttons
    document.getElementById('btn-zoom-in')?.addEventListener('click', () => {
        const rect = canvasContainer.getBoundingClientRect();
        zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, ZOOM_STEP);
    });

    document.getElementById('btn-zoom-out')?.addEventListener('click', () => {
        const rect = canvasContainer.getBoundingClientRect();
        zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, -ZOOM_STEP);
    });
}

/**
 * Start panning
 */
function startPan(x, y) {
    isPanning = true;
    panStartX = x - offsetX;
    panStartY = y - offsetY;
    canvasContainer.classList.add('panning');
}

/**
 * Continue panning
 */
function pan(x, y) {
    if (!isPanning) return;

    offsetX = x - panStartX;
    offsetY = y - panStartY;
    applyTransform();
}

/**
 * End panning
 */
function endPan() {
    isPanning = false;
    canvasContainer.classList.remove('panning');
}

/**
 * Zoom at a specific point (keeps point in place)
 */
function zoomAt(clientX, clientY, delta) {
    const rect = canvasContainer.getBoundingClientRect();
    const mouseX = clientX - rect.left;
    const mouseY = clientY - rect.top;

    const oldScale = scale;
    scale = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, scale + delta));

    // Adjust offset to zoom toward mouse position
    const scaleRatio = scale / oldScale;
    offsetX = mouseX - (mouseX - offsetX) * scaleRatio;
    offsetY = mouseY - (mouseY - offsetY) * scaleRatio;

    applyTransform();
    updateZoomDisplay();
}

/**
 * Apply the current transform to the viewport
 * Connections layer is NOT transformed (uses screen coords)
 */
function applyTransform() {
    const transform = `translate(${offsetX}px, ${offsetY}px) scale(${scale})`;

    // Only transform the viewport (which contains nodes)
    if (viewport) {
        viewport.style.transform = transform;
    }

    // Connections layer is NOT transformed - it uses screen coordinates
    // connectionsLayer.style.transform = transform; // REMOVED

    if (onTransformChange) {
        onTransformChange({ scale, offsetX, offsetY });
    }
}

/**
 * Update zoom level display
 */
function updateZoomDisplay() {
    const zoomLevel = document.getElementById('zoom-level');
    if (zoomLevel) {
        zoomLevel.textContent = `${Math.round(scale * 100)}%`;
    }
}

/**
 * Get touch distance for pinch zoom
 */
function getTouchDistance(touches) {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Get touch center for pinch zoom
 */
function getTouchCenter(touches) {
    return {
        x: (touches[0].clientX + touches[1].clientX) / 2,
        y: (touches[0].clientY + touches[1].clientY) / 2
    };
}

/**
 * Convert screen coordinates to canvas coordinates
 * @param {number} screenX - Screen X
 * @param {number} screenY - Screen Y
 * @returns {Object} { x, y } in canvas space
 */
export function screenToCanvas(screenX, screenY) {
    const rect = canvasContainer.getBoundingClientRect();
    return {
        x: (screenX - rect.left - offsetX) / scale,
        y: (screenY - rect.top - offsetY) / scale
    };
}

/**
 * Convert canvas coordinates to screen coordinates
 * @param {number} canvasX - Canvas X
 * @param {number} canvasY - Canvas Y
 * @returns {Object} { x, y } in screen space
 */
export function canvasToScreen(canvasX, canvasY) {
    const rect = canvasContainer.getBoundingClientRect();
    return {
        x: canvasX * scale + offsetX + rect.left,
        y: canvasY * scale + offsetY + rect.top
    };
}

/**
 * Get current transform state
 */
export function getTransform() {
    return { scale, offsetX, offsetY };
}

/**
 * Set transform state
 */
export function setTransform(newScale, newOffsetX, newOffsetY) {
    scale = newScale;
    offsetX = newOffsetX;
    offsetY = newOffsetY;
    applyTransform();
    updateZoomDisplay();
}

/**
 * Reset zoom to 100% and center
 */
export function resetZoom() {
    scale = 1;
    offsetX = 0;
    offsetY = 0;
    applyTransform();
    updateZoomDisplay();
}

/**
 * Center view on a specific point
 */
export function centerOn(canvasX, canvasY) {
    const rect = canvasContainer.getBoundingClientRect();
    offsetX = rect.width / 2 - canvasX * scale;
    offsetY = rect.height / 2 - canvasY * scale;
    applyTransform();
}

/**
 * Setup keyboard shortcuts for canvas
 */
function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        // Don't trigger if editing text
        if (isEditingText()) return;

        // F = Fit to view (find your project!)
        if (e.key === 'f' || e.key === 'F') {
            e.preventDefault();
            fitToView();
        }

        // 0 or Home = Reset zoom to 100%
        if (e.key === '0' || e.key === 'Home') {
            e.preventDefault();
            resetZoom();
        }
    });
}

/**
 * Setup double-click to create node (ComfyUI style)
 */
function setupDoubleClick() {
    canvasContainer.addEventListener('dblclick', (e) => {
        // Ignore if clicking on a node or UI
        if (e.target.closest('.node') || e.target.closest('.node-toolbar') || e.target.closest('button')) return;

        e.preventDefault(); // Prevent default text selection or zoom

        const { x, y } = screenToCanvas(e.clientX, e.clientY);

        import('./nodes.js').then(({ addNodeAtLocation }) => {
            addNodeAtLocation(x, y);
        });
    });
}

/**
 * Fit all nodes in the viewport
 * Calculates bounding box and adjusts zoom/pan to show everything
 */
export function fitToView() {
    const nodes = nodesLayer.querySelectorAll('.node');
    if (nodes.length === 0) {
        // No nodes - just reset
        resetZoom();
        return;
    }

    // Calculate bounding box of all nodes (in canvas space)
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    nodes.forEach(node => {
        const x = parseFloat(node.style.left) || 0;
        const y = parseFloat(node.style.top) || 0;
        const w = node.offsetWidth;
        const h = node.offsetHeight;

        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x + w);
        maxY = Math.max(maxY, y + h);
    });

    // Add padding
    const padding = 60;
    minX -= padding;
    minY -= padding;
    maxX += padding;
    maxY += padding;

    // Calculate content size
    const contentWidth = maxX - minX;
    const contentHeight = maxY - minY;

    // Calculate container size
    const containerRect = canvasContainer.getBoundingClientRect();
    const containerWidth = containerRect.width;
    const containerHeight = containerRect.height;

    // Calculate scale to fit
    const scaleX = containerWidth / contentWidth;
    const scaleY = containerHeight / contentHeight;
    let newScale = Math.min(scaleX, scaleY);

    // Clamp scale to limits
    newScale = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newScale));

    // Calculate center of content
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    // Set new transform
    scale = newScale;
    offsetX = containerWidth / 2 - centerX * scale;
    offsetY = containerHeight / 2 - centerY * scale;

    applyTransform();
    updateZoomDisplay();
}
