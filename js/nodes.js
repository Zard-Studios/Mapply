/**
 * nodes.js – Node creation, management, and interactions
 */

import { createNode, createConnection } from './schema.js';
import { screenToCanvas } from './canvas.js';
import { updateConnections } from './connections.js';

// State
let nodesLayer = null;
let currentMap = null;
let selectedNodeId = null;
let dragState = null;
let activeToolbar = null; // Track which toolbar is visible
let phantomNode = null;

// Callbacks
let onNodeChange = null;

// Font size presets
const FONT_SIZES = [14, 18, 24, 32];
const DEFAULT_FONT_SIZE = 18;

/**
 * Initialize nodes module
 */
export function initNodes(map, options = {}) {
    nodesLayer = document.getElementById('nodes-layer');
    currentMap = map;
    onNodeChange = options.onNodeChange;

    renderAllNodes();

    document.getElementById('btn-add-node')?.addEventListener('click', () => {
        addNodeAtCenter();
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.node') && !e.target.closest('.node-toolbar')) {
            hideAllToolbars();
            if (selectedNodeId && !e.target.closest('.connection-path')) {
                selectNode(null);
            }
        }
    });

    document.addEventListener('keydown', (e) => {
        const active = document.activeElement;
        const isEditing = active && (active.isContentEditable || active.tagName === 'INPUT' || active.tagName === 'TEXTAREA');

        if ((e.key === 'Backspace' || e.key === 'Delete') && selectedNodeId) {
            if (isEditing) return;
            e.preventDefault();
            deleteNode(selectedNodeId);
        }

        if (e.key === 'Enter' && selectedNodeId && !isEditing) {
            e.preventDefault();
            const nodeEl = document.getElementById(selectedNodeId);
            const contentEl = nodeEl?.querySelector('.node-content');
            const toolbar = nodeEl?.querySelector('.node-toolbar');
            if (contentEl && toolbar) {
                enterEditMode(contentEl, toolbar);
            }
        }
    });

    createPhantomNode();
}

/**
 * Create the phantom node for drag-to-create preview
 */
function createPhantomNode() {
    if (phantomNode || !nodesLayer) return;
    phantomNode = document.createElement('div');
    phantomNode.className = 'node-phantom';
    nodesLayer.appendChild(phantomNode);
}

/**
 * Update phantom node position
 */
function updatePhantomNode(clientX, clientY) {
    if (!phantomNode) return;
    const { x, y } = screenToCanvas(clientX, clientY);
    phantomNode.style.left = `${x - 80}px`;
    phantomNode.style.top = `${y - 40}px`;
    phantomNode.style.display = 'block';
}

/**
 * Hide phantom node
 */
function hidePhantomNode() {
    if (phantomNode) phantomNode.style.display = 'none';
}

/**
 * Update the current map reference
 */
export function setCurrentMap(map) {
    currentMap = map;
    renderAllNodes();
}

/**
 * Render all nodes from current map
 */
export function renderAllNodes() {
    nodesLayer.innerHTML = '';
    if (!currentMap || !currentMap.nodes) return;
    currentMap.nodes.forEach(node => {
        renderNode(node);
    });
}

/**
 * Render a single node
 */
function renderNode(nodeData) {
    const node = document.createElement('div');
    node.className = `node node-${nodeData.type}`;
    node.id = nodeData.id;
    node.style.left = `${nodeData.x}px`;
    node.style.top = `${nodeData.y}px`;

    const fontSize = nodeData.fontSize || DEFAULT_FONT_SIZE;
    const textAlign = nodeData.textAlign || 'center';

    node.innerHTML = `
    <div class="node-toolbar" data-visible="false">
      <button class="toolbar-btn" data-action="bold" aria-label="Grassetto" title="Grassetto (Ctrl+B)">
        <span class="toolbar-label">B</span>
      </button>
      <button class="toolbar-btn" data-action="italic" aria-label="Corsivo" title="Corsivo (Ctrl+I)">
        <span class="toolbar-label italic">I</span>
      </button>
      <button class="toolbar-btn" data-action="underline" aria-label="Sottolineato" title="Sottolineato (Ctrl+U)">
        <span class="toolbar-label underline">U</span>
      </button>
      <div class="toolbar-divider"></div>
      <button class="toolbar-btn" data-action="align-left" aria-label="Allinea a sinistra" title="Allinea a sinistra">
        <svg class="toolbar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="17" y1="10" x2="3" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="17" y1="18" x2="3" y2="18"/></svg>
      </button>
      <button class="toolbar-btn" data-action="align-center" aria-label="Allinea al centro" title="Allinea al centro">
        <svg class="toolbar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="10" x2="6" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="18" y1="18" x2="6" y2="18"/></svg>
      </button>
      <button class="toolbar-btn" data-action="align-right" aria-label="Allinea a destra" title="Allinea a destra">
        <svg class="toolbar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="21" y1="10" x2="7" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="21" y1="18" x2="7" y2="18"/></svg>
      </button>
      <div class="toolbar-divider"></div>
      <div class="font-size-control">
        <input type="number" class="font-size-input" value="${fontSize}" min="8" max="72" title="Digita dimensione">
        <span class="font-size-unit">pt</span>
      </div>
      <div class="toolbar-divider"></div>
      <button class="toolbar-btn delete-btn" data-action="delete" aria-label="Elimina" title="Elimina nodo">
        <svg class="toolbar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
        </svg>
      </button>
    </div>
    <div class="node-content" contenteditable="true" spellcheck="false" data-placeholder="Scrivi qui..." style="font-size: ${fontSize}pt; text-align: ${textAlign};">${nodeData.content || ''}</div>
    <div class="node-handle node-handle-top" data-handle="top"></div>
    <div class="node-handle node-handle-bottom" data-handle="bottom"></div>
    <div class="node-handle node-handle-left" data-handle="left"></div>
    <div class="node-handle node-handle-right" data-handle="right"></div>
  `;

    setupNodeEvents(node, nodeData);
    nodesLayer.appendChild(node);
}

/**
 * Setup event listeners for a node
 */
function setupNodeEvents(nodeEl, nodeData) {
    const toolbar = nodeEl.querySelector('.node-toolbar');
    const contentEl = nodeEl.querySelector('.node-content');

    contentEl.setAttribute('contenteditable', 'false');

    nodeEl.addEventListener('mousedown', (e) => {
        if (e.target.closest('.node-toolbar')) return;
        if (e.target.closest('.node-handle')) return;
        if (window.isSpacePanMode) return;

        const isContent = !!e.target.closest('.node-content');
        const isEditable = contentEl.getAttribute('contenteditable') === 'true';

        // If clicking inside editable content, keep focus and let browser handle it (selection)
        if (isContent && isEditable) {
            return;
        }

        // Click on padding/borders while in edit mode:
        // Prevent default to avoid blurring the text, but allow dragging the node
        if (isEditable && !isContent) {
            e.preventDefault();
        }

        selectNode(nodeData.id);
        startDrag(e, nodeEl, nodeData);
    });

    nodeEl.addEventListener('dblclick', (e) => {
        if (e.target.closest('.node-toolbar')) return;
        if (e.target.closest('.node-handle')) return;
        if (contentEl.getAttribute('contenteditable') === 'true') return;
        enterEditMode(contentEl, toolbar);
    });

    contentEl.addEventListener('focus', () => {
        showToolbar(toolbar);
    });

    contentEl.addEventListener('blur', () => {
        // Snappier delay (50ms) to check if focus moved to toolbar
        setTimeout(() => {
            const active = document.activeElement;
            const toToolbar = active?.closest('.node-toolbar');
            if (toToolbar && toToolbar.closest('.node') === nodeEl) return;

            if (contentEl.getAttribute('contenteditable') === 'true') {
                exitEditMode(contentEl, toolbar);
            }
        }, 50);
    });

    toolbar.querySelectorAll('.toolbar-btn').forEach(btn => {
        btn.addEventListener('mousedown', (e) => {
            e.preventDefault();
        });
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const action = btn.dataset.action;
            if (action === 'bold' || action === 'italic' || action === 'underline') {
                // If we have a visual highlight, make it a real selection first
                const highlight = contentEl.querySelector('.temp-selection-highlight');
                if (highlight) {
                    const sel = window.getSelection();
                    const range = document.createRange();
                    range.selectNodeContents(highlight);
                    sel.removeAllRanges();
                    sel.addRange(range);
                }

                applyTextStyle(action);
                updateToolbarState(toolbar, contentEl);
                contentEl.focus();

                // Ensure changes are saved
                updateNodeField(nodeData.id, 'content', contentEl.innerHTML);
            } else if (action.startsWith('align-')) {
                const alignment = action.replace('align-', '');
                // Handle selection pre-selection
                const highlight = contentEl.querySelector('.temp-selection-highlight');
                if (highlight) {
                    const sel = window.getSelection();
                    const range = document.createRange();
                    range.selectNodeContents(highlight);
                    sel.removeAllRanges();
                    sel.addRange(range);
                }

                setNodeAlignment(nodeEl, nodeData, alignment);
                updateToolbarState(toolbar, contentEl);
                contentEl.focus();
            } else if (action === 'delete') {
                deleteNode(nodeData.id);
            }
        });
    });

    const fontSizeControl = toolbar.querySelector('.font-size-control');
    const fontInput = toolbar.querySelector('.font-size-input');
    let savedSelection = null;

    if (fontSizeControl && fontInput) {
        fontSizeControl.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            const selection = window.getSelection();
            if (selection.rangeCount > 0 && contentEl.contains(selection.anchorNode) && !selection.isCollapsed) {
                const existing = contentEl.querySelector('.temp-selection-highlight');
                if (existing) return;

                savedSelection = selection.getRangeAt(0).cloneRange();
                try {
                    const range = selection.getRangeAt(0);
                    const span = document.createElement('span');
                    span.className = 'temp-selection-highlight';
                    const fragment = range.extractContents();
                    span.appendChild(fragment);
                    range.insertNode(span);
                } catch (err) {
                    console.warn('Highlight failed', err);
                }
            }
        });

        const removeHighlight = () => {
            const highlights = contentEl.querySelectorAll('.temp-selection-highlight');
            highlights.forEach(span => {
                // If the span has actual styling (like a font size we just set), 
                // we keep it as a formatting span but remove the highlight class.
                if (span.style.fontSize) {
                    span.classList.remove('temp-selection-highlight');
                } else {
                    // It was just a temporary placeholder for focus, unwrap it
                    while (span.firstChild) {
                        span.parentNode.insertBefore(span.firstChild, span);
                    }
                    span.remove();
                }
            });
            contentEl.normalize();
        };

        fontInput.addEventListener('input', (e) => {
            const val = e.target.value;
            const size = parseInt(val);
            // Allow typing any number, just clamp reasonably for rendering
            if (!isNaN(size) && size >= 1 && size <= 300) {
                setNodeFontSize(nodeEl, nodeData, size);
            }
        });

        fontInput.addEventListener('blur', () => {
            setTimeout(() => {
                // When we blur the input, we finally "commit" the highlight or remove it
                const highlights = contentEl.querySelectorAll('.temp-selection-highlight');
                highlights.forEach(span => {
                    span.classList.remove('temp-selection-highlight');
                });
                removeHighlight(); // Unwrap those spans if they are just placeholders
            }, 150);
        });

        fontInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                contentEl.focus(); // Return focus to content
            }
        });
    }

    contentEl.addEventListener('input', () => {
        updateNodeField(nodeData.id, 'content', contentEl.innerHTML);
        updateConnections(currentMap);
    });

    contentEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            if (e.shiftKey) {
                // Let Shift+Enter perform its default action (newline)
                return;
            } else {
                // Enter only: commit changes and exit immediately
                e.preventDefault();
                const wasEditable = contentEl.getAttribute('contenteditable') === 'true';
                if (wasEditable) {
                    exitEditMode(contentEl, toolbar);
                    contentEl.blur();
                }
            }
        }

        if (e.ctrlKey || e.metaKey) {
            if (e.key === 'b') { e.preventDefault(); applyTextStyle('bold'); }
            else if (e.key === 'i') { e.preventDefault(); applyTextStyle('italic'); }
            else if (e.key === 'u') { e.preventDefault(); applyTextStyle('underline'); }
        }
    });

    contentEl.addEventListener('mouseup', () => updateToolbarState(toolbar, contentEl));
    contentEl.addEventListener('keyup', () => updateToolbarState(toolbar, contentEl));

    nodeEl.querySelectorAll('.node-handle').forEach(handle => {
        handle.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            startConnection(nodeData.id);
        });
    });
}

/**
 * Enter edit mode
 */
function enterEditMode(contentEl, toolbar) {
    const nodeEl = contentEl.closest('.node');
    if (nodeEl) nodeEl.classList.add('editing');

    contentEl.setAttribute('contenteditable', 'true');
    contentEl.focus();
    const range = document.createRange();
    range.selectNodeContents(contentEl);
    range.collapse(false);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    showToolbar(toolbar);
}

/**
 * Exit edit mode immediately
 */
function exitEditMode(contentEl, toolbar) {
    const nodeEl = contentEl.closest('.node');
    if (nodeEl) nodeEl.classList.remove('editing');

    contentEl.setAttribute('contenteditable', 'false');
    hideToolbar(toolbar);
    window.getSelection().removeAllRanges();
}

/**
 * Show toolbar
 */
function showToolbar(toolbar) {
    const node = toolbar.closest('.node');
    hideAllToolbars(node);
    toolbar.dataset.visible = 'true';
    activeToolbar = toolbar;
    const contentEl = node?.querySelector('.node-content');
    if (contentEl) updateToolbarState(toolbar, contentEl);
}

/**
 * Hide toolbar
 */
function hideToolbar(toolbar) {
    if (!toolbar) return;
    toolbar.dataset.visible = 'false';
    toolbar.closest('.node')?.classList.remove('editing');
    if (activeToolbar === toolbar) activeToolbar = null;
}

/**
 * Hide all toolbars
 */
function hideAllToolbars(excludeNode = null) {
    const nodes = document.querySelectorAll('.node');
    nodes.forEach(node => {
        if (excludeNode && node === excludeNode) return;

        // Hide toolbar
        const toolbar = node.querySelector('.node-toolbar');
        if (toolbar) toolbar.dataset.visible = 'false';

        // Disable edit mode
        const content = node.querySelector('.node-content');
        if (content) content.setAttribute('contenteditable', 'false');

        // Remove visual indicators
        node.classList.remove('editing');
    });

    if (!excludeNode) {
        activeToolbar = null;
        window.getSelection()?.removeAllRanges();
    }
}

/**
 * Set font size
 */
function setNodeFontSize(nodeEl, nodeData, size) {
    const contentEl = nodeEl.querySelector('.node-content');

    // 1. Check for visual highlight (fake selection)
    const highlight = contentEl.querySelector('.temp-selection-highlight');
    if (highlight) {
        highlight.style.fontSize = `${size}pt`;

        // CRITICAL: Remove font-size from all children so they inherit the new size
        // Otherwise, previous inline styles (e.g. <span style="font-size:12pt">) block the update
        const children = highlight.querySelectorAll('*');
        children.forEach(child => {
            child.style.fontSize = '';
        });

        // Re-select to keep selection active for other buttons, 
        // BUT ONLY IF we are not currently typing in the input (which would steal focus)
        const active = document.activeElement;
        const isFontInput = active && active.classList.contains('font-size-input');

        if (!isFontInput) {
            const sel = window.getSelection();
            const range = document.createRange();
            range.selectNodeContents(highlight);
            sel.removeAllRanges();
            sel.addRange(range);
        }

        updateConnections(currentMap);
        updateNodeField(nodeData.id, 'content', contentEl.innerHTML);
        return;
    }
    // 2. Fallback to real selection
    const selection = window.getSelection();
    let hasSelection = selection && selection.rangeCount > 0 && !selection.isCollapsed && contentEl.contains(selection.anchorNode);

    if (hasSelection) {
        const range = selection.getRangeAt(0);
        if (contentEl.contains(range.commonAncestorContainer) || range.commonAncestorContainer === contentEl) {
            const span = document.createElement('span');
            span.style.fontSize = `${size}pt`;
            try {
                const fragment = range.extractContents();
                span.appendChild(fragment);
                range.insertNode(span);

                selection.removeAllRanges();
                const newRange = document.createRange();
                newRange.selectNodeContents(span);
                selection.addRange(newRange);

                updateConnections(currentMap);
                updateNodeField(nodeData.id, 'content', contentEl.innerHTML);
                return;
            } catch (e) {
                console.error('Font resize error', e);
            }
        }
    }

    // 3. No selection = apply to entire node
    contentEl.style.fontSize = `${size}pt`;
    updateNodeField(nodeData.id, 'fontSize', size);
    updateConnections(currentMap);
}

/**
 * Set text alignment
 */
function setNodeAlignment(nodeEl, nodeData, alignment) {
    const contentEl = nodeEl.querySelector('.node-content');

    // 1. Check for visual highlight (fake selection)
    const highlight = contentEl.querySelector('.temp-selection-highlight');
    if (highlight) {
        // Alignment applies to blocks, not inline spans. 
        // We shouldn't set display:block on the span as it breaks layout.
        // Instead, select the span contents and let execCommand align the parent block.
        const sel = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(highlight);
        sel.removeAllRanges();
        sel.addRange(range);

        // Remove the highlight class so it doesn't get stuck
        highlight.classList.remove('temp-selection-highlight');
        // Let legacy clean up unwrapping if needed, or execCommand might handle it.
        // Proceed to use execCommand below...
    }

    // 2. Fallback to real selection
    const selection = window.getSelection();
    let hasSelection = selection && selection.rangeCount > 0 && !selection.isCollapsed && contentEl.contains(selection.anchorNode);

    if (hasSelection) {
        const cmd = alignment === 'center' ? 'justifyCenter' : (alignment === 'right' ? 'justifyRight' : 'justifyLeft');
        document.execCommand(cmd, false, null);
        updateNodeField(nodeData.id, 'content', contentEl.innerHTML);
        updateConnections(currentMap);
        return;
    }

    // 3. No selection = apply to entire node
    contentEl.style.textAlign = alignment;
    updateNodeField(nodeData.id, 'textAlign', alignment);
    updateNodeField(nodeData.id, 'content', contentEl.innerHTML);
}

/**
 * Apply style
 */
function applyTextStyle(style) {
    document.execCommand(style, false, null);
}

/**
 * Update toolbar button states
 */
function updateToolbarState(toolbar, contentEl) {
    if (!toolbar) return;
    const isBold = document.queryCommandState('bold');
    const isItalic = document.queryCommandState('italic');
    const isUnderline = document.queryCommandState('underline');

    toolbar.querySelector('[data-action="bold"]')?.classList.toggle('active', isBold);
    toolbar.querySelector('[data-action="italic"]')?.classList.toggle('active', isItalic);
    toolbar.querySelector('[data-action="underline"]')?.classList.toggle('active', isUnderline);
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        let container = null;

        // ELEMENT NODE SELECTION Strategy:
        // ELEMENT NODE SELECTION Strategy:
        // If startContainer is an element (e.g. contentEl), the selection starts at a specific child index.
        // We must look at that child node to find the style, not the container itself.
        if (range.startContainer.nodeType === Node.ELEMENT_NODE) {
            // Get the node implied by the offset
            const offset = range.startOffset;
            const children = range.startContainer.childNodes;

            if (offset < children.length) {
                // If selection starts at child 0, target is children[0]
                const targetNode = children[offset];
                if (targetNode.nodeType === Node.ELEMENT_NODE) {
                    container = targetNode;
                } else if (targetNode.nodeType === Node.TEXT_NODE) {
                    container = targetNode.parentElement;
                }
            } else if (children.length > 0) {
                // If offset is at end, check the last child
                const targetNode = children[children.length - 1];
                if (targetNode.nodeType === Node.ELEMENT_NODE) {
                    container = targetNode;
                } else if (targetNode.nodeType === Node.TEXT_NODE) {
                    container = targetNode.parentElement;
                }
            }
        } else {
            // TEXT NODE Strategy:
            // Standard parentElement check
            container = range.startContainer.parentElement;
        }

        // --- Edge Case Handling ---

        // 1. Collapsed selection (cursor) prioritization
        if (selection.isCollapsed && selection.anchorNode) {
            let anchorParent = selection.anchorNode;
            if (anchorParent.nodeType === Node.TEXT_NODE) anchorParent = anchorParent.parentElement;
            if (contentEl.contains(anchorParent)) {
                container = anchorParent;
            }
        }

        if (container && (contentEl.contains(container) || container === contentEl)) {
            const computedStyle = window.getComputedStyle(container);

            // FONT SIZE: Climb up looking for literal 'pt' or 'px' in STYLE attribute (inline)
            // This prioritizes what the user explicitly set over computed/inherited values
            let sizePt = 0;
            let currentNode = container;

            // Check up to contentEl (inclusive if it's an element)
            while (currentNode) {
                if (currentNode.nodeType === Node.ELEMENT_NODE) {
                    const inlineSize = currentNode.style?.fontSize;
                    if (inlineSize && inlineSize.endsWith('pt')) {
                        sizePt = parseInt(inlineSize);
                        break;
                    }
                }
                if (currentNode === contentEl) break;
                currentNode = currentNode.parentElement;
            }

            // Fallback to computed px -> pt (1px = 0.75pt)
            // Fallback: If no explicit inline style found, trust the computed style of the NEAREST element
            if (sizePt === 0) {
                // computedStyle is already from 'container' (the immediate element/parent of text)
                // So this should be accurate to what is clicked.
                const px = parseFloat(computedStyle.fontSize);
                // Standard browser px is 96dpi, pt is 72dpi -> 1px = 0.75pt
                sizePt = Math.round(px * 0.75);
            }

            // --- MIXED FONT SIZE DETECTION ---
            const fontInput = toolbar.querySelector('.font-size-input');

            if (fontInput) {
                let displayValue = sizePt;

                // Only check for mixed sizes if we have a range selection (not just cursor)
                if (!selection.isCollapsed) {
                    const range = selection.getRangeAt(0);
                    // Create a walker to check every text node in the selection
                    const walker = document.createTreeWalker(
                        range.commonAncestorContainer,
                        NodeFilter.SHOW_TEXT,
                        {
                            acceptNode: (node) => {
                                // Only accept nodes that are at least partially selected
                                if (selection.containsNode(node, true)) return NodeFilter.FILTER_ACCEPT;
                                return NodeFilter.FILTER_REJECT;
                            }
                        }
                    );

                    let firstSize = null;
                    let isMixed = false;
                    let currentNode = walker.nextNode();

                    while (currentNode) {
                        // Determine size for this specific text node
                        let nodeSize = 0;
                        let parent = currentNode.parentElement;

                        // Check inline styles up to contentEl
                        let tempParent = parent;
                        while (tempParent && contentEl.contains(tempParent)) {
                            if (tempParent.style?.fontSize?.endsWith('pt')) {
                                nodeSize = parseInt(tempParent.style.fontSize);
                                break;
                            }
                            if (tempParent === contentEl) break;
                            tempParent = tempParent.parentElement;
                        }

                        // Fallback to computed
                        if (nodeSize === 0) {
                            const px = parseFloat(window.getComputedStyle(parent).fontSize);
                            nodeSize = Math.round(px * 0.75);
                        }

                        if (firstSize === null) {
                            firstSize = nodeSize;
                        } else if (firstSize !== nodeSize) {
                            isMixed = true;
                            break;
                        }
                        currentNode = walker.nextNode();
                    }

                    if (isMixed) {
                        displayValue = '-';
                    } else if (firstSize !== null) {
                        // If we checked multiple nodes and they are uniform, prefer that confirmed size
                        displayValue = firstSize;
                    }
                }

                // Only update if not currently focused to avoid fighting the user
                if (document.activeElement !== fontInput) {
                    fontInput.value = displayValue;
                }
            }

            // ALIGNMENT from computed style
            const currentAlign = computedStyle.textAlign;
            toolbar.querySelector('[data-action="align-left"]')?.classList.toggle('active', currentAlign === 'left' || currentAlign === 'start');
            toolbar.querySelector('[data-action="align-center"]')?.classList.toggle('active', currentAlign === 'center');
            toolbar.querySelector('[data-action="align-right"]')?.classList.toggle('active', currentAlign === 'right' || currentAlign === 'end');
        }
    }
}

/**
 * Start dragging
 */
function startDrag(e, nodeEl, nodeData) {
    if (dragState) {
        document.getElementById(dragState.nodeId)?.classList.remove('dragging');
    }
    const currentX = parseFloat(nodeEl.style.left) || nodeData.x;
    const currentY = parseFloat(nodeEl.style.top) || nodeData.y;
    dragState = {
        nodeId: nodeData.id,
        startX: e.clientX,
        startY: e.clientY,
        nodeStartX: currentX,
        nodeStartY: currentY
    };
    nodeEl.classList.add('dragging');
    const onMouseMove = (me) => {
        if (!dragState) return;
        const el = document.getElementById(dragState.nodeId);
        if (!el) return;
        const { scale } = window.canvasTransform || { scale: 1 };
        const dx = (me.clientX - dragState.startX) / scale;
        const dy = (me.clientY - dragState.startY) / scale;
        el.style.left = `${dragState.nodeStartX + dx}px`;
        el.style.top = `${dragState.nodeStartY + dy}px`;
        updateConnections(currentMap);
    };
    const onMouseUp = (ue) => {
        if (!dragState) return;
        const el = document.getElementById(dragState.nodeId);
        const { scale } = window.canvasTransform || { scale: 1 };
        const dx = (ue.clientX - dragState.startX) / scale;
        const dy = (ue.clientY - dragState.startY) / scale;
        updateNodeField(dragState.nodeId, 'x', Math.round(dragState.nodeStartX + dx));
        updateNodeField(dragState.nodeId, 'y', Math.round(dragState.nodeStartY + dy));
        el?.classList.remove('dragging');
        dragState = null;
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
}

/**
 * Select a node
 */
export function selectNode(nodeId) {
    if (selectedNodeId) document.getElementById(selectedNodeId)?.classList.remove('selected');
    selectedNodeId = nodeId;
    if (nodeId) {
        const el = document.getElementById(nodeId);
        if (el) {
            el.classList.add('selected');
        }
    }
}

/**
 * Add node at center
 */
function addNodeAtCenter() {
    if (!currentMap) return;
    const container = document.getElementById('canvas-container');
    const rect = container.getBoundingClientRect();
    const center = screenToCanvas(rect.left + rect.width / 2, rect.top + rect.height / 2);
    return addNodeAtLocation(center.x, center.y);
}

/**
 * Add node at specific canvas location
 */
export function addNodeAtLocation(x, y) {
    if (!currentMap) return;
    const hasMain = currentMap.nodes.some(n => n.type === 'main');
    const type = !hasMain ? 'main' : 'secondary';
    const node = createNode({
        type,
        content: '',
        fontSize: DEFAULT_FONT_SIZE,
        x: Math.round(x),
        y: Math.round(y)
    });
    currentMap.nodes.push(node);
    renderNode(node);
    selectNode(node.id);

    // Auto edit mode
    setTimeout(() => {
        const nodeEl = document.getElementById(node.id);
        const contentEl = nodeEl?.querySelector('.node-content');
        const toolbar = nodeEl?.querySelector('.node-toolbar');
        if (contentEl && toolbar) {
            enterEditMode(contentEl, toolbar);
        }
    }, 50);

    onNodeChange?.();
    return node;
}

/**
 * Delete a node
 */
export function deleteNode(nodeId) {
    if (!currentMap) return;
    const index = currentMap.nodes.findIndex(n => n.id === nodeId);
    if (index === -1) return;
    currentMap.nodes.splice(index, 1);
    currentMap.connections = currentMap.connections.filter(c => c.from !== nodeId && c.to !== nodeId);
    document.getElementById(nodeId)?.remove();
    if (selectedNodeId === nodeId) selectedNodeId = null;
    updateConnections(currentMap);
    onNodeChange?.();
}

/**
 * Clean HTML content from temporary editor classes/spans
 */
function cleanNodeContent(html) {
    const div = document.createElement('div');
    div.innerHTML = html;

    // Remove temporary highlight classes
    div.querySelectorAll('.temp-selection-highlight').forEach(span => {
        if (span.style.fontSize) {
            span.classList.remove('temp-selection-highlight');
        } else {
            // Unwrap placeholder spans
            while (span.firstChild) {
                span.parentNode.insertBefore(span.firstChild, span);
            }
            span.remove();
        }
    });

    return div.innerHTML;
}

/**
 * Update a node field
 */
function updateNodeField(nodeId, field, value) {
    if (!currentMap) return;
    const node = currentMap.nodes.find(n => n.id === nodeId);
    if (node) {
        if (field === 'content') {
            node[field] = cleanNodeContent(value);
        } else {
            node[field] = value;
        }
        onNodeChange?.();
    }
}

/**
 * Start connection
 */
function startConnection(fromNodeId) {
    const container = document.getElementById('canvas-container');
    container.classList.add('connecting');
    import('./connections.js').then(({ startConnectionPreview, endConnectionPreview }) => {
        startConnectionPreview(fromNodeId);

        const onMouseMove = (e) => {
            const target = e.target.closest('.node-handle') || e.target.closest('.node');
            if (!target) {
                updatePhantomNode(e.clientX, e.clientY);
            } else {
                hidePhantomNode();
            }
        };

        const onMouseUp = (e) => {
            container.classList.remove('connecting');
            endConnectionPreview();
            hidePhantomNode();

            const target = e.target.closest('.node-handle') || e.target.closest('.node');
            if (target) {
                const toNodeEl = target.closest('.node');
                if (toNodeEl && toNodeEl.id !== fromNodeId) createNodeConnection(fromNodeId, toNodeEl.id);
            } else {
                // Drop on empty space -> Create new node
                const { x, y } = screenToCanvas(e.clientX, e.clientY);
                // Center node on mouse (roughly 160x80)
                const newNode = addNodeAtLocation(x - 80, y - 40);
                createNodeConnection(fromNodeId, newNode.id);
            }
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    });
}

/**
 * Create connection
 */
function createNodeConnection(fromId, toId) {
    if (!currentMap) return;
    const exists = currentMap.connections.some(c => (c.from === fromId && c.to === toId) || (c.from === toId && c.to === fromId));
    if (exists) return;
    const connection = createConnection(fromId, toId);
    currentMap.connections.push(connection);
    updateConnections(currentMap);
    onNodeChange?.();
}

/**
 * Get selected node ID
 */
export function getSelectedNodeId() {
    return selectedNodeId;
}
