/**
 * Clean Module
 * Manages the UI lifecycle of the Cleaning/Refinement Modal.
 * Handles fragment preloading, ID extraction from URL, and modal state.
 */
import { Actions } from './ui/actions.js';
import { API } from './ui/api.js';

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
     * @returns {string|null}
     */
    _getDatasetIdFromUrl() {
        const parts = window.location.pathname.split('/').filter(p => p !== "");
        return parts.length > 0 ? parts[parts.length - 1] : null;
    },

    /**
     * Opens the cleaning modal and injects the content fragment.
     * Automatically initializes logic with backend column names.
     */
    async show() {
        const modal = document.getElementById('cleanModal');
        const placeholder = document.getElementById('clean-content-placeholder');

        if (!modal || !placeholder) return;

        // 1. Identify Dataset ID from URL
        const datasetId = this._getDatasetIdFromUrl();
        if (!datasetId) {
            console.error("Navigation Error: No Dataset ID found in URL.");
            alert("Could not identify the dataset session.");
            return;
        }

        // 2. UI Setup: Lock Scroll
        const scrollBarWidth = window.innerWidth - document.documentElement.clientWidth;
        document.body.style.paddingRight = `${scrollBarWidth}px`;
        document.body.style.overflow = 'hidden';
        modal.classList.add('active');

        // 3. Set Loading State
        placeholder.innerHTML = `
            <div class="text-center p-5">
                <div class="spinner-border text-primary mb-3" role="status"></div>
                <p class="text-muted small fw-medium">Preparing surgery suite...</p>
            </div>
        `;

        try {
            // 4. Parallel Fetch: Metadata (for columns) and Fragment (HTML)
            // Using Promise.all for faster loading
            const [meta, fragmentResponse] = await Promise.all([
                API.fetchMeta(datasetId),
                this._cache ? Promise.resolve(this._cache) : fetch('/clean-fragment').then(r => r.text())
            ]);

            // Cache the fragment for subsequent opens
            if (!this._cache) this._cache = fragmentResponse;

            // 5. Inject Content
            placeholder.innerHTML = this._cache;

            // 6. Initialize logic with the dynamic column list from backend
            // This ensures the "Drop Columns" select is populated immediately
            Actions.Dedupe.prepare(datasetId, meta.columns || []);

            // 7. Render Icons
            if (window.lucide) window.lucide.createIcons();

        } catch (error) {
            console.error("Clean Modal Load Error:", error);
            placeholder.innerHTML = `
                <div class="text-center p-5">
                    <i data-lucide="alert-triangle" class="text-danger mb-3" style="width:40px; height:40px;"></i>
                    <h5 class="fw-bold">Module Unavailable</h5>
                    <p class="text-muted small">Could not sync with the cleaning engine.</p>
                    <button class="btn btn-sm btn-outline-secondary mt-3" onclick="Clean.close()">Dismiss</button>
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
window.Clean = Clean;
window.Actions = Actions;
window.DataDeduplicator = Actions.Dedupe;

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => Clean.init());
} else {
    Clean.init();
}
