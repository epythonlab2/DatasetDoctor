import { Actions } from '../ui/actions.js';
import { API } from '../api.js';
import { state } from '../utils/state.js';

export const Clean = {
    /**
     * This runs automatically when the page loads.
     * No more fetching! The HTML is already provided by FastAPI.
     */
    async init() {
        // 1. Grab the Dataset ID from the body attribute or the URL
        // Your FastAPI template likely puts it in data-dataset-id
        const datasetId = document.body.dataset.datasetId || window.location.pathname.split('/').pop();
        
        if (!datasetId) {
            console.error("Clean Engine: Could not find Dataset ID on this page.");
            return;
        }

        // 2. Synchronize the global state
        state.datasetId = datasetId;

        try {
            // 3. Fetch Metadata (we still need this for column lists/stats)
            const meta = await API.fetchMeta(datasetId);

            // 4. Initialize the Actions and UI components
            // This hooks up your dropdowns and the deduplicator logic
            Actions.Dedupe.prepare(datasetId, meta.columns || []);
            
            // 5. Ensure the Batch UI (Run Analysis bar) is synced
            if (typeof Actions._updateBatchUI === 'function') {
                Actions._updateBatchUI();
            }

            // 6. Refresh icons
            if (window.lucide) window.lucide.createIcons();

            console.log("Clean Workspace Initialized for:", datasetId);

        } catch (error) {
            console.error("Initialization Error:", error);
        }
    }
};

// --- GLOBAL EXPOSURE ---
// This is still required so your HTML onclicks work!
window.Actions = Actions;
window.Clean = Clean;
window.DataDeduplicator = Actions.Dedupe;

// Run the init function immediately since the HTML is already there
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => Clean.init());
} else {
    Clean.init();
}
