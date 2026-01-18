/**
 * Auto-layout algorithm for mind map nodes
 * Arranges nodes in a proper tree hierarchy
 */

/**
 * Auto-arrange all nodes in a clean tree layout
 */
export async function autoLayoutMap() {
    const { getCurrentMap } = await import('./app.js');
    const { renderAllNodes } = await import('./nodes.js');
    const { updateConnections } = await import('./connections.js');

    const map = getCurrentMap();
    if (!map || !map.nodes || map.nodes.length === 0) return;

    console.log('[AutoLayout] Starting layout for', map.nodes.length, 'nodes');

    // Build graph structure
    const childrenOf = new Map(); // parentId -> [childIds]
    const parentOf = new Map();   // childId -> parentId

    map.connections.forEach(conn => {
        if (!childrenOf.has(conn.from)) childrenOf.set(conn.from, []);
        childrenOf.get(conn.from).push(conn.to);
        parentOf.set(conn.to, conn.from);
    });

    // Find root nodes (nodes with no parent)
    const roots = map.nodes.filter(n => !parentOf.has(n.id));

    // If no roots found, use nodes with type 'main' or just first node
    if (roots.length === 0) {
        const mainNode = map.nodes.find(n => n.type === 'main') || map.nodes[0];
        if (mainNode) roots.push(mainNode);
    }

    console.log('[AutoLayout] Found roots:', roots.map(r => r.content?.substring(0, 20)));

    // Layout settings
    const LEVEL_HEIGHT = 200;      // Vertical spacing between levels
    const MIN_NODE_SPACING = 280;  // Minimum horizontal spacing
    const NODE_WIDTH = 220;

    // Get viewport center
    const canvas = document.getElementById('viewport');
    const rect = canvas?.getBoundingClientRect() || { width: 1400, height: 900 };

    // Track positioned nodes
    const positioned = new Set();

    /**
     * Calculate the width needed for a subtree
     */
    function getSubtreeWidth(nodeId) {
        const children = childrenOf.get(nodeId) || [];
        if (children.length === 0) {
            return MIN_NODE_SPACING;
        }
        let totalWidth = 0;
        children.forEach(childId => {
            totalWidth += getSubtreeWidth(childId);
        });
        return Math.max(totalWidth, MIN_NODE_SPACING);
    }

    /**
     * Position a node and its children recursively
     */
    function layoutNode(nodeId, x, y, availableWidth) {
        const node = map.nodes.find(n => n.id === nodeId);
        if (!node || positioned.has(nodeId)) return;

        positioned.add(nodeId);

        // Center this node in available width
        node.x = x + (availableWidth / 2) - (NODE_WIDTH / 2);
        node.y = y;

        console.log('[AutoLayout] Positioned:', node.content?.substring(0, 20), 'at', node.x, node.y);

        // Get children
        const children = childrenOf.get(nodeId) || [];
        if (children.length === 0) return;

        // Calculate total width needed for children
        const childWidths = children.map(childId => getSubtreeWidth(childId));
        const totalChildWidth = childWidths.reduce((a, b) => a + b, 0);

        // Start position for first child
        let childX = x + (availableWidth / 2) - (totalChildWidth / 2);

        // Layout each child
        children.forEach((childId, i) => {
            layoutNode(childId, childX, y + LEVEL_HEIGHT, childWidths[i]);
            childX += childWidths[i];
        });
    }

    // Layout each root tree
    let rootX = 100;
    const totalRootWidth = roots.reduce((sum, root) => sum + getSubtreeWidth(root.id), 0);
    rootX = (rect.width / 2) - (totalRootWidth / 2);

    roots.forEach(root => {
        const treeWidth = getSubtreeWidth(root.id);
        layoutNode(root.id, rootX, 80, treeWidth);
        rootX += treeWidth;
    });

    // Position any orphan nodes (not connected to anything)
    let orphanY = 80;
    let orphanX = rootX + 200;
    map.nodes.forEach(node => {
        if (!positioned.has(node.id)) {
            node.x = orphanX;
            node.y = orphanY;
            orphanX += MIN_NODE_SPACING;
            if (orphanX > rect.width - 200) {
                orphanX = rootX + 200;
                orphanY += LEVEL_HEIGHT;
            }
        }
    });

    console.log('[AutoLayout] Layout complete. Positioned:', positioned.size, 'nodes');

    // Re-render
    renderAllNodes();
    setTimeout(() => updateConnections(map), 50);

    return { success: true, nodesPositioned: positioned.size };
}
