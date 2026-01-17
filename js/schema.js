/**
 * schema.js – JSON Schema for concept maps
 * SIMPLIFIED: Removed icons, colors, node limits
 * Nodes now have just 'content' (HTML with styling)
 */

// Current schema version
export const SCHEMA_VERSION = '1.1';

/**
 * Generate a unique ID
 * @returns {string} Unique ID prefixed with type
 */
export function generateId(prefix = 'item') {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create a new empty map
 * @param {string} title - Map title
 * @returns {Object} New map object
 */
export function createEmptyMap(title = 'Nuova Mappa') {
    return {
        version: SCHEMA_VERSION,
        id: generateId('map'),
        title,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        theme: 'light',
        nodes: [],
        connections: []
    };
}

/**
 * Create a new node
 * SIMPLIFIED: Just type, content (HTML), and position
 * @param {Object} options - Node options
 * @returns {Object} New node object
 */
export function createNode({
    type = 'secondary',
    content = '',
    fontSize = 18,
    x = 400,
    y = 300
} = {}) {
    return {
        id: generateId('node'),
        type,
        content,
        fontSize,
        x,
        y
    };
}

/**
 * Create a new connection
 * @param {string} fromId - Source node ID
 * @param {string} toId - Target node ID
 * @returns {Object} New connection object
 */
export function createConnection(fromId, toId) {
    return {
        id: generateId('conn'),
        from: fromId,
        to: toId
    };
}

/**
 * Validate a map object against the schema
 * @param {Object} map - Map to validate
 * @returns {Object} { valid: boolean, errors: string[] }
 */
export function validateMap(map) {
    const errors = [];

    // Required fields
    if (!map.version) errors.push('Missing version');
    if (!map.id) errors.push('Missing id');
    if (!map.title) errors.push('Missing title');
    if (!Array.isArray(map.nodes)) errors.push('nodes must be an array');
    if (!Array.isArray(map.connections)) errors.push('connections must be an array');

    // Validate nodes
    if (Array.isArray(map.nodes)) {
        map.nodes.forEach((node, i) => {
            if (!node.id) errors.push(`Node ${i}: missing id`);
            if (typeof node.x !== 'number') errors.push(`Node ${i}: x must be a number`);
            if (typeof node.y !== 'number') errors.push(`Node ${i}: y must be a number`);
        });
    }

    // Validate connections
    if (Array.isArray(map.connections)) {
        const nodeIds = new Set(map.nodes?.map(n => n.id) || []);
        map.connections.forEach((conn, i) => {
            if (!conn.from) errors.push(`Connection ${i}: missing from`);
            if (!conn.to) errors.push(`Connection ${i}: missing to`);
            if (conn.from && !nodeIds.has(conn.from)) {
                errors.push(`Connection ${i}: from node not found`);
            }
            if (conn.to && !nodeIds.has(conn.to)) {
                errors.push(`Connection ${i}: to node not found`);
            }
        });
    }

    return {
        valid: errors.length === 0,
        errors
    };
}

/**
 * Example valid map (for reference)
 * SIMPLIFIED: Just content, no icons/colors
 */
export const EXAMPLE_MAP = {
    version: '1.1',
    id: 'map_example',
    title: 'La Rivoluzione Francese',
    createdAt: '2026-01-17T02:08:05Z',
    updatedAt: '2026-01-17T02:08:05Z',
    theme: 'light',
    nodes: [
        {
            id: 'node_1',
            type: 'main',
            content: '<b>Rivoluzione Francese</b><br>1789-1799',
            x: 400,
            y: 200
        },
        {
            id: 'node_2',
            type: 'secondary',
            content: '<b>Cause</b><br>Crisi economica, fame',
            x: 200,
            y: 350
        },
        {
            id: 'node_3',
            type: 'secondary',
            content: '<b>Eventi chiave</b><br>Presa della Bastiglia',
            x: 400,
            y: 350
        },
        {
            id: 'node_4',
            type: 'secondary',
            content: '<b>Conseguenze</b><br>Fine della monarchia',
            x: 600,
            y: 350
        }
    ],
    connections: [
        { id: 'conn_1', from: 'node_1', to: 'node_2' },
        { id: 'conn_2', from: 'node_1', to: 'node_3' },
        { id: 'conn_3', from: 'node_1', to: 'node_4' }
    ]
};
