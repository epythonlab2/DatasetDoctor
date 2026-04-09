/**
 * Clean Module
 * Manages the UI lifecycle of the Cleaning/Refinement Modal.
 * Handles fragment preloading, ID extraction from URL, and modal state.
 */
import { Actions } from './ui/actions.js';

export const Clean = {
    /** @type {string|null} Stores the HTML fragment to prevent redundant network requests */
    _cache: null,

    /**
     * Initializes global event listeners for the modal.
     */
    init() {
        const modal = document.getElementById('cleanModal');
        if (!modal) return;

        // Close modal when clicking on the backdrop
        modal.addEventListener('click', (e) => {
            if (e.target === modal) this.close();
        });

        // Close modal on Escape key press
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modal.classList.contains('active')) {
                this.close();
            }
        });
    },

    /**
     * Extracts the Dataset UUID from the current URL path.
     * Safely handles trailing slashes.
     * @returns {string|null}
     */
    _getDatasetIdFromUrl() {
        const parts = window.location.pathname.split('/').filter(p => p !== "");
        return parts.length > 0 ? parts[parts.length - 1] : null;
    },

    /**
     * Opens the cleaning modal and injects the content fragment.
     * Automatically initializes the DataDeduplicator logic.
     */
    async show() {
        const modal = document.getElementById('cleanModal');
        const placeholder = document.getElementById('clean-content-placeholder');

        if (!modal || !placeholder) return;

        // 1. Identify Dataset
        const datasetId = this._getDatasetIdFromUrl();
        if (!datasetId) {
            console.error("Navigation Error: No Dataset ID found in URL.");
            alert("Could not identify the dataset session.");
            return;
        }

        // 2. Prevent Layout Shift & Lock Scroll
        const scrollBarWidth = window.innerWidth - document.documentElement.clientWidth;
        document.body.style.paddingRight = `${scrollBarWidth}px`;
        document.body.style.overflow = 'hidden';
        modal.classList.add('active');

        // 3. Set Initial Loading State
        placeholder.innerHTML = `
            <div class="text-center p-5">
                <div class="spinner-border text-primary mb-3" role="status"></div>
                <p class="text-muted small fw-medium">Sterilizing tools and preparing surgery...</p>
            </div>
        `;

        try {
            // 4. Fetch Fragment (use cache if available)
            if (!this._cache) {
                const response = await fetch('/clean-fragment');
                if (!response.ok) throw new Error('Failed to fetch the clean-fragment route.');
                this._cache = await response.text();
            }

            placeholder.innerHTML = this._cache;

            // 5. Link UI to Logic
            // We use the Dedupe sub-module from our unified Actions module
            Actions.Dedupe.prepare(datasetId);

            // Re-render icons for the newly injected HTML
            if (window.lucide) window.lucide.createIcons();

        } catch (error) {
            console.error("Clean Modal Error:", error);
            placeholder.innerHTML = `
                <div class="text-center p-5">
                    <i data-lucide="alert-triangle" class="text-danger mb-3" style="width:40px; height:40px;"></i>
                    <h5 class="fw-bold">Module Offline</h5>
                    <p class="text-muted small">The cleaning engine could not be initialized.</p>
                    <button class="btn btn-sm btn-outline-secondary mt-2" onclick="Clean.close()">Dismiss</button>
                </div>
            `;
            if (window.lucide) window.lucide.createIcons();
        }
    },

    /**
     * Closes the modal and restores global scroll.
     */
    close() {
        const modal = document.getElementById('cleanModal');
        if (modal) {
            modal.classList.remove('active');
            document.body.style.overflow = '';
            document.body.style.paddingRight = '';
        }
    }
};

// --- GLOBAL EXPOSURE ---
// These ensure onclick="Clean.show()" and onclick="Actions.reset()" work in raw HTML
window.Clean = Clean;
window.Actions = Actions;
window.DataDeduplicator = Actions.Dedupe; 

/**
 * Self-initialization based on document state
 */
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => Clean.init());
} else {
    Clean.init();
}
