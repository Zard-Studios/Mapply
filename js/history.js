/**
 * history.js - Simple Undo/Redo history manager
 */

const MAX_HISTORY = 50;

class HistoryManager {
    constructor() {
        this.undoStack = [];
        this.redoStack = [];
        this.currentState = null;
    }

    /**
     * Clear history (e.g. when loading a new map)
     * @param {Object} initialState - The starting state of the map
     */
    clear(initialState) {
        this.undoStack = [];
        this.redoStack = [];
        // Store a deep copy of the initial state
        this.currentState = JSON.parse(JSON.stringify(initialState));
    }

    /**
     * Push a new state to history
     * Should be called AFTER a change is made to the map
     * @param {Object} newState - The new state of the map
     */
    push(newState) {
        if (!this.currentState) {
            this.currentState = JSON.parse(JSON.stringify(newState));
            return;
        }

        // Push the PREVIOUS state to undo stack
        this.undoStack.push(this.currentState);

        // Limit stack size
        if (this.undoStack.length > MAX_HISTORY) {
            this.undoStack.shift();
        }

        // Clear redo stack because we branched off
        this.redoStack = [];

        // Update current state reference
        this.currentState = JSON.parse(JSON.stringify(newState));

        console.log(`History pushed via Snapshot. Undo: ${this.undoStack.length}, Redo: ${this.redoStack.length}`);
    }

    /**
     * Perform Undo
     * @returns {Object|null} The state to restore, or null if no undo available
     */
    undo() {
        if (this.undoStack.length === 0) return null;

        const previousState = this.undoStack.pop();

        // Push current state to redo
        if (this.currentState) {
            this.redoStack.push(this.currentState);
        }

        this.currentState = previousState;
        return JSON.parse(JSON.stringify(previousState));
    }

    /**
     * Perform Redo
     * @returns {Object|null} The state to restore, or null if no redo available
     */
    redo() {
        if (this.redoStack.length === 0) return null;

        const nextState = this.redoStack.pop();

        // Push current state to undo
        if (this.currentState) {
            this.undoStack.push(this.currentState);
        }

        this.currentState = nextState;
        return JSON.parse(JSON.stringify(nextState));
    }

    canUndo() {
        return this.undoStack.length > 0;
    }

    canRedo() {
        return this.redoStack.length > 0;
    }
}

export const history = new HistoryManager();
