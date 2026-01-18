/**
 * Auto-layout algorithm for mind map nodes
 * Arranges nodes hierarchically based on connections
 */

/**
 * Auto-arrange all nodes in a clean hierarchical layout
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
    const rootNodes = new Set(map.nodes.map(n => n.id));

    map.connections.forEach(conn => {
        if (!childrenOf.has(conn.from)) childrenOf.set(conn.from, []);
        childrenOf.get(conn.from).push(conn.to);
        parentOf.set(conn.to, conn.from);
        rootNodes.delete(conn.to); // Not a root if it has a parent
    });

    // Layout settings
    const HORIZONTAL_SPACING = 320;
    const VERTICAL_SPACING = 200;
    const NODE_WIDTH = 200;

    // Get viewport center
    const canvas = document.getElementById('viewport');
    const rect = canvas?.getBoundingClientRect() || { width: 1200, height: 800 };
    const centerX = rect.width / 2;

    // Find the main node (or first root)
    let mainNode = map.nodes.find(n => n.type === 'main');
    if (!mainNode && rootNodes.size > 0) {
        mainNode = map.nodes.find(n => rootNodes.has(n.id));
    }

    // Track positions
    const positioned = new Set();
    let currentY = 80;

    // Position a subtree recursively
    function layoutSubtree(nodeId, level, xStart, xEnd) {
        const node = map.nodes.find(n => n.id === nodeId);
        if (!node || positioned.has(nodeId)) return { width: 0 };

        positioned.add(nodeId);
        const children = childrenOf.get(nodeId) || [];

        if (children.length === 0) {
            // Leaf node - position at center of available space
            node.x = (xStart + xEnd) / 2 - NODE_WIDTH / 2;
            node.y = level * VERTICAL_SPACING + 80;
            return { width: HORIZONTAL_SPACING };
        }

        // Layout children first to determine spacing
        const childWidths = [];
        let totalWidth = 0;

        children.forEach(childId => {
            const childNode = map.nodes.find(n => n.id === childId);
            if (childNode && !positioned.has(childId)) {
                const grandChildren = childrenOf.get(childId) || [];
                const width = Math.max(HORIZONTAL_SPACING, grandChildren.length * HORIZONTAL_SPACING);
                childWidths.push({ id: childId, width });
                totalWidth += width;
            }
        });

        // Position this node at center
        const nodeX = (xStart + xEnd) / 2 - NODE_WIDTH / 2;
        node.x = nodeX;
        node.y = level * VERTICAL_SPACING + 80;

        // Position children
        let childX = nodeX - totalWidth / 2 + HORIZONTAL_SPACING / 2;
        childWidths.forEach(({ id, width }) => {
            layoutSubtree(id, level + 1, childX - width / 2, childX + width / 2);
            childX += width;
        });

        return { width: Math.max(totalWidth, HORIZONTAL_SPACING) };
    }

    // Layout from main node
    if (mainNode) {
        layoutSubtree(mainNode.id, 0, 0, rect.width);
    }

    // Layout any remaining unpositioned root nodes
    let orphanX = 100;
    rootNodes.forEach(rootId => {
        if (!positioned.has(rootId)) {
            const node = map.nodes.find(n => n.id === rootId);
            if (node) {
                node.x = orphanX;
                node.y = 80;
                orphanX += HORIZONTAL_SPACING;
                positioned.add(rootId);

                // Layout its subtree
                const children = childrenOf.get(rootId) || [];
                let childX = node.x;
                children.forEach(childId => {
                    layoutSubtree(childId, 1, childX, childX + HORIZONTAL_SPACING);
                    childX += HORIZONTAL_SPACING;
                });
            }
        }
    });

    // Layout any completely orphan nodes (no connections)
    map.nodes.forEach(node => {
        if (!positioned.has(node.id)) {
            node.x = orphanX;
            node.y = 500;
            orphanX += HORIZONTAL_SPACING;
        }
    });

    console.log('[AutoLayout] Layout complete');

    // Re-render
    renderAllNodes();
    setTimeout(() => updateConnections(map), 50);

    return { success: true, nodesPositioned: positioned.size };
}
