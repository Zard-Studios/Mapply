/**
 * io.js – Import/Export functionality
 * Handles JSON file save and load
 */

import { validateMap } from './schema.js';

/**
 * Export a map to a JSON file
 * @param {Object} map - Map data to export
 */
export function exportMapToFile(map) {
    // Create a clean copy for export
    const exportData = {
        ...map,
        exportedAt: new Date().toISOString()
    };

    // Convert to JSON string with pretty formatting
    const jsonString = JSON.stringify(exportData, null, 2);

    // Create blob and download link
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    // Create filename from title
    const filename = sanitizeFilename(map.title) + '.json';

    // Trigger download
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Cleanup
    URL.revokeObjectURL(url);

    return true;
}

/**
 * Import a map from a JSON file
 * @param {File} file - File to import
 * @returns {Promise<Object>} Imported map data
 */
export function importMapFromFile(file) {
    return new Promise((resolve, reject) => {
        if (!file) {
            reject(new Error('Nessun file selezionato'));
            return;
        }

        if (!file.name.endsWith('.json')) {
            reject(new Error('Il file deve essere in formato JSON'));
            return;
        }

        const reader = new FileReader();

        reader.onload = (event) => {
            try {
                const jsonString = event.target.result;
                const data = JSON.parse(jsonString);

                // Validate the imported data
                const validation = validateMap(data);

                if (!validation.valid) {
                    reject(new Error('File non valido: ' + validation.errors.join(', ')));
                    return;
                }

                // Update timestamps
                data.updatedAt = new Date().toISOString();

                resolve(data);
            } catch (e) {
                reject(new Error('Errore nel parsing del file JSON'));
            }
        };

        reader.onerror = () => {
            reject(new Error('Errore nella lettura del file'));
        };

        reader.readAsText(file);
    });
}

/**
 * Open file picker for import
 * @returns {Promise<Object>} Imported map data
 */
export function openImportDialog() {
    return new Promise((resolve, reject) => {
        const input = document.getElementById('file-import');

        if (!input) {
            reject(new Error('Input file non trovato'));
            return;
        }

        const handleChange = async (event) => {
            const file = event.target.files[0];
            input.removeEventListener('change', handleChange);
            input.value = ''; // Reset for next use

            if (!file) {
                reject(new Error('Nessun file selezionato'));
                return;
            }

            try {
                const map = await importMapFromFile(file);
                resolve(map);
            } catch (e) {
                reject(e);
            }
        };

        input.addEventListener('change', handleChange);
        input.click();
    });
}

/**
 * Sanitize a string for use as a filename
 * @param {string} name - Original name
 * @returns {string} Sanitized filename
 */
function sanitizeFilename(name) {
    return name
        .toLowerCase()
        .replace(/[àáâãäå]/g, 'a')
        .replace(/[èéêë]/g, 'e')
        .replace(/[ìíîï]/g, 'i')
        .replace(/[òóôõö]/g, 'o')
        .replace(/[ùúûü]/g, 'u')
        .replace(/[^a-z0-9]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '')
        .substring(0, 50) || 'mappa';
}
