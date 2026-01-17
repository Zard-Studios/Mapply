/**
 * app.js – Main application entry point
 * Initializes all modules and handles app lifecycle
 */

import { createEmptyMap, EXAMPLE_MAP, generateId } from './schema.js';
import {
    initDatabase,
    saveMap,
    loadMap,
    deleteMap,
    getAllMaps,
    getLastMapId,
    setLastMapId
} from './storage.js';
import { initCanvas, getTransform } from './canvas.js';
import { initNodes, setCurrentMap, renderAllNodes } from './nodes.js';
import { initConnections, updateConnections } from './connections.js';
import { exportMapToFile, openImportDialog } from './io.js';
import {
    initUI,
    showToast,
    setMapTitle,
    getMapTitle,
    onMapTitleChange,
    renderMapList
} from './ui.js';
import { isAIEnabled, generateMapFromText } from './aiAdapter.js';

// Current map state
let currentMap = null;
let saveTimeout = null;

/**
 * Initialize the application
 */
async function init() {
    try {
        // Initialize database
        await initDatabase();

        // Initialize UI components
        initUI();
        initConnections();

        // Initialize canvas with transform callback
        initCanvas({
            onTransformChange: (transform) => {
                window.canvasTransform = transform;
            }
        });

        // Load maps and set current
        await loadInitialMap();

        // Setup event listeners
        setupEventListeners();

        // Register service worker for offline support
        registerServiceWorker();

        console.log('Mapply initialized successfully');

    } catch (error) {
        console.error('Failed to initialize Mapply:', error);
        showToast('Errore di inizializzazione', 'error');
    }
}

/**
 * Load the initial map (last opened or create new)
 */
async function loadInitialMap() {
    const maps = await getAllMaps();
    const lastMapId = getLastMapId();

    // Try to load last opened map
    if (lastMapId) {
        const map = await loadMap(lastMapId);
        if (map) {
            setActiveMap(map);
            renderMapList(maps, map.id, { onSelect: switchToMap, onDelete: handleDeleteMap });
            return;
        }
    }

    // If no maps exist, create a new one with example data
    if (maps.length === 0) {
        const newMap = { ...EXAMPLE_MAP, id: generateId('map') };
        await saveMap(newMap);
        setActiveMap(newMap);
        renderMapList([newMap], newMap.id, { onSelect: switchToMap, onDelete: handleDeleteMap });
        return;
    }

    // Otherwise, load the most recent map
    const mostRecent = maps[0];
    setActiveMap(mostRecent);
    renderMapList(maps, mostRecent.id, { onSelect: switchToMap, onDelete: handleDeleteMap });
}

/**
 * Set the active map and render it
 */
function setActiveMap(map) {
    currentMap = map;
    setLastMapId(map.id);

    // Update UI
    setMapTitle(map.title);

    // Initialize nodes with map data
    initNodes(map, {
        onNodeChange: () => scheduleAutoSave()
    });

    // Render connections
    updateConnections(map);
}

/**
 * Switch to a different map
 */
async function switchToMap(mapId) {
    if (currentMap && currentMap.id === mapId) return;

    // Save current map first
    if (currentMap) {
        await saveCurrentMap();
    }

    // Load new map
    const map = await loadMap(mapId);
    if (map) {
        setActiveMap(map);

        // Update map list
        const maps = await getAllMaps();
        renderMapList(maps, map.id, { onSelect: switchToMap, onDelete: handleDeleteMap });

        showToast('Mappa caricata');
    }
}

/**
 * Create a new map
 */
async function createNewMap() {
    // Save current map first
    if (currentMap) {
        await saveCurrentMap();
    }

    const newMap = createEmptyMap();
    await saveMap(newMap);
    setActiveMap(newMap);

    // Update map list
    const maps = await getAllMaps();
    renderMapList(maps, newMap.id, { onSelect: switchToMap, onDelete: handleDeleteMap });

    showToast('Nuova mappa creata');
}

/**
 * Handle map deletion
 */
async function handleDeleteMap(mapId) {
    await deleteMap(mapId);

    // If we deleted the current map, switch to another
    if (currentMap && currentMap.id === mapId) {
        const maps = await getAllMaps();
        if (maps.length > 0) {
            setActiveMap(maps[0]);
            renderMapList(maps, maps[0].id, { onSelect: switchToMap, onDelete: handleDeleteMap });
        } else {
            // Create a new map if none left
            await createNewMap();
        }
    } else {
        // Just refresh the list
        const maps = await getAllMaps();
        renderMapList(maps, currentMap?.id, { onSelect: switchToMap, onDelete: handleDeleteMap });
    }

    showToast('Mappa eliminata');
}

/**
 * Save the current map
 */
async function saveCurrentMap() {
    if (!currentMap) return;

    currentMap.title = getMapTitle();
    await saveMap(currentMap);
}

/**
 * Schedule auto-save (debounced)
 */
function scheduleAutoSave() {
    if (saveTimeout) {
        clearTimeout(saveTimeout);
    }

    saveTimeout = setTimeout(async () => {
        await saveCurrentMap();
        console.log('Auto-saved');
    }, 1000);
}

/**
 * Setup all event listeners
 */
function setupEventListeners() {
    // Title change
    onMapTitleChange((newTitle) => {
        if (currentMap) {
            currentMap.title = newTitle;
            scheduleAutoSave();

            // Update map list
            getAllMaps().then(maps => {
                renderMapList(maps, currentMap.id, { onSelect: switchToMap, onDelete: handleDeleteMap });
            });
        }
    });

    // New map button
    document.getElementById('btn-new-map')?.addEventListener('click', createNewMap);

    // Save button
    document.getElementById('btn-save')?.addEventListener('click', async () => {
        await saveCurrentMap();
        showToast('Mappa salvata', 'success');
    });

    // Export button
    document.getElementById('btn-export')?.addEventListener('click', () => {
        if (currentMap) {
            currentMap.title = getMapTitle();
            exportMapToFile(currentMap);
            showToast('Mappa esportata', 'success');
        }
    });

    // Import button
    document.getElementById('btn-import')?.addEventListener('click', async () => {
        try {
            const importedMap = await openImportDialog();

            // Generate new ID to avoid conflicts
            importedMap.id = generateId('map');

            await saveMap(importedMap);
            setActiveMap(importedMap);

            const maps = await getAllMaps();
            renderMapList(maps, importedMap.id, { onSelect: switchToMap, onDelete: handleDeleteMap });

            showToast('Mappa importata', 'success');
        } catch (error) {
            showToast(error.message, 'error');
        }
    });

    // AI generate button (disabled for now)
    document.getElementById('btn-ai-generate')?.addEventListener('click', async () => {
        const input = document.getElementById('ai-input');
        const text = input?.value?.trim();

        if (!text) {
            showToast('Inserisci un argomento', 'warning');
            return;
        }

        try {
            const result = await generateMapFromText(text);
            // TODO: Apply AI result to current map
            console.log('AI Result:', result);
        } catch (error) {
            showToast(error.message, 'error');
        }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // Ctrl/Cmd + S to save
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            saveCurrentMap().then(() => showToast('Mappa salvata', 'success'));
        }

        // Ctrl/Cmd + E to export
        if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
            e.preventDefault();
            if (currentMap) {
                currentMap.title = getMapTitle();
                exportMapToFile(currentMap);
                showToast('Mappa esportata', 'success');
            }
        }
    });

    // Save before unload
    window.addEventListener('beforeunload', () => {
        if (currentMap) {
            // Synchronous save attempt
            navigator.sendBeacon?.('/api/save', JSON.stringify(currentMap));
        }
    });
}

/**
 * Register service worker for offline support
 */
function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js')
            .then(reg => console.log('Service Worker registered'))
            .catch(err => console.log('Service Worker registration failed:', err));
    }
}

// Start the application
init();
