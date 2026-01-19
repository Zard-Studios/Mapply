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

    console.log('[AutoLayout] ========================================');
    console.log('[AutoLayout] Starting layout for', map.nodes.length, 'nodes');
    console.log('[AutoLayout] Connections:', map.connections?.length || 0);

    // Log all connections for debugging
    console.log('[AutoLayout] Connection details:');
    map.connections?.forEach(conn => {
        const fromNode = map.nodes.find(n => n.id === conn.from);
        const toNode = map.nodes.find(n => n.id === conn.to);
        console.log('  ', fromNode?.content?.substring(0, 15) || conn.from, '→', toNode?.content?.substring(0, 15) || conn.to);
    });

    // Build graph structure
    const childrenOf = new Map(); // parentId -> [childIds]
    const parentOf = new Map();   // childId -> parentId

    map.connections.forEach(conn => {
        if (!childrenOf.has(conn.from)) childrenOf.set(conn.from, []);
        childrenOf.get(conn.from).push(conn.to);
        parentOf.set(conn.to, conn.from);
    });

    // Find root nodes (nodes with no parent)
    let roots = map.nodes.filter(n => !parentOf.has(n.id));

    console.log('[AutoLayout] Root candidates (no parent):', roots.map(r => r.content?.substring(0, 20)));

    // If no roots found or too many, prioritize by type
    if (roots.length === 0) {
        const mainNode = map.nodes.find(n => n.type === 'main') || map.nodes[0];
        if (mainNode) roots = [mainNode];
    }

    console.log('[AutoLayout] Final roots:', roots.map(r => r.content?.substring(0, 20)));

    // Layout settings
    const LEVEL_HEIGHT = 220;      // Vertical spacing between levels
    const MIN_NODE_SPACING = 50;   // Minimum gap between nodes
    const BASE_NODE_WIDTH = 180;   // Base width for short content
    const CHAR_WIDTH = 7;          // Approximate pixels per character

    // Get viewport center
    const canvas = document.getElementById('viewport');
    const rect = canvas?.getBoundingClientRect() || { width: 1400, height: 900 };

    // Track positioned nodes
    const positioned = new Set();

    /**
     * Estimate node width based on content length
     */
    function estimateNodeWidth(nodeId) {
        const node = map.nodes.find(n => n.id === nodeId);
        if (!node) return BASE_NODE_WIDTH;

        // Strip HTML and get text length
        const text = (node.content || '').replace(/<[^>]*>/g, '');
        // Estimate width: each line is ~25-30 chars, node wraps text
        const charsPerLine = 25;
        const numLines = Math.ceil(text.length / charsPerLine);
        const width = Math.min(text.length, charsPerLine) * CHAR_WIDTH + 40; // padding

        return Math.max(BASE_NODE_WIDTH, Math.min(width, 350)); // Cap at 350px
    }

    /**
     * Calculate the width needed for a subtree
     */
    function getSubtreeWidth(nodeId) {
        const nodeWidth = estimateNodeWidth(nodeId);
        const children = childrenOf.get(nodeId) || [];

        if (children.length === 0) {
            return nodeWidth + MIN_NODE_SPACING;
        }

        let totalWidth = 0;
        children.forEach(childId => {
            totalWidth += getSubtreeWidth(childId);
        });

        return Math.max(totalWidth, nodeWidth + MIN_NODE_SPACING);
    }

    /**
     * Position a node and its children recursively
     */
    function layoutNode(nodeId, x, y, availableWidth) {
        const node = map.nodes.find(n => n.id === nodeId);
        if (!node || positioned.has(nodeId)) return;

        positioned.add(nodeId);

        // Center this node in available width, using estimated width
        const nodeWidth = estimateNodeWidth(nodeId);
        node.x = x + (availableWidth / 2) - (nodeWidth / 2);
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
