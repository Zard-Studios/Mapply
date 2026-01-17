/**
 * storage.js – IndexedDB persistence for maps
 * All data stays local on user's device
 */

const DB_NAME = 'mapply';
const DB_VERSION = 1;
const STORE_MAPS = 'maps';

let db = null;

/**
 * Initialize the IndexedDB database
 * @returns {Promise<IDBDatabase>}
 */
export async function initDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            db = request.result;
            resolve(db);
        };

        request.onupgradeneeded = (event) => {
            const database = event.target.result;

            // Create maps store with id as key
            if (!database.objectStoreNames.contains(STORE_MAPS)) {
                const store = database.createObjectStore(STORE_MAPS, { keyPath: 'id' });
                store.createIndex('updatedAt', 'updatedAt', { unique: false });
                store.createIndex('title', 'title', { unique: false });
            }
        };
    });
}

/**
 * Get database instance (initialize if needed)
 * @returns {Promise<IDBDatabase>}
 */
async function getDb() {
    if (!db) {
        await initDatabase();
    }
    return db;
}

/**
 * Save a map to IndexedDB
 * @param {Object} map - Map object to save
 * @returns {Promise<void>}
 */
export async function saveMap(map) {
    const database = await getDb();

    // Update timestamp
    map.updatedAt = new Date().toISOString();

    return new Promise((resolve, reject) => {
        const tx = database.transaction(STORE_MAPS, 'readwrite');
        const store = tx.objectStore(STORE_MAPS);
        const request = store.put(map);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve();
    });
}

/**
 * Load a map by ID
 * @param {string} id - Map ID
 * @returns {Promise<Object|null>}
 */
export async function loadMap(id) {
    const database = await getDb();

    return new Promise((resolve, reject) => {
        const tx = database.transaction(STORE_MAPS, 'readonly');
        const store = tx.objectStore(STORE_MAPS);
        const request = store.get(id);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result || null);
    });
}

/**
 * Delete a map by ID
 * @param {string} id - Map ID
 * @returns {Promise<void>}
 */
export async function deleteMap(id) {
    const database = await getDb();

    return new Promise((resolve, reject) => {
        const tx = database.transaction(STORE_MAPS, 'readwrite');
        const store = tx.objectStore(STORE_MAPS);
        const request = store.delete(id);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve();
    });
}

/**
 * Get all maps (sorted by updatedAt, newest first)
 * @returns {Promise<Object[]>}
 */
export async function getAllMaps() {
    const database = await getDb();

    return new Promise((resolve, reject) => {
        const tx = database.transaction(STORE_MAPS, 'readonly');
        const store = tx.objectStore(STORE_MAPS);
        const index = store.index('updatedAt');
        const request = index.openCursor(null, 'prev'); // Descending order

        const maps = [];

        request.onerror = () => reject(request.error);
        request.onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor) {
                maps.push(cursor.value);
                cursor.continue();
            } else {
                resolve(maps);
            }
        };
    });
}

/**
 * Clear all maps (for testing/reset)
 * @returns {Promise<void>}
 */
export async function clearAllMaps() {
    const database = await getDb();

    return new Promise((resolve, reject) => {
        const tx = database.transaction(STORE_MAPS, 'readwrite');
        const store = tx.objectStore(STORE_MAPS);
        const request = store.clear();

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve();
    });
}

/**
 * Get the last opened map ID from localStorage
 * @returns {string|null}
 */
export function getLastMapId() {
    return localStorage.getItem('mapply_last_map');
}

/**
 * Set the last opened map ID in localStorage
 * @param {string} id - Map ID
 */
export function setLastMapId(id) {
    localStorage.setItem('mapply_last_map', id);
}

/**
 * Get current theme from localStorage
 * @returns {string} 'light' or 'dark'
 */
export function getTheme() {
    return localStorage.getItem('mapply_theme') || 'light';
}

/**
 * Set theme in localStorage
 * @param {string} theme - 'light' or 'dark'
 */
export function setTheme(theme) {
    localStorage.setItem('mapply_theme', theme);
}
