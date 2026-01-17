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

    // Initial transform
    applyTransform();
    updateZoomDisplay();
}

/**
 * Setup panning with mouse and touch
 */
function setupPanning() {
    // Mouse panning (middle button or spacebar + drag)
    canvasContainer.addEventListener('mousedown', (e) => {
        // Middle mouse button or left button on canvas background
        if (e.button === 1 || (e.button === 0 && e.target === canvasContainer)) {
            startPan(e.clientX, e.clientY);
            e.preventDefault();
        }
    });

    document.addEventListener('mousemove', (e) => {
        if (isPanning) {
            pan(e.clientX, e.clientY);
        }
    });

    document.addEventListener('mouseup', () => {
        endPan();
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
