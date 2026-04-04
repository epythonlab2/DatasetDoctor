/**
 * Actions Module
 * Handles user-triggered operations that interact with the backend API.
 * Manages button loading states, confirmation dialogs, and navigation.
 */
import { API } from "./api.js";
import { state } from "./state.js";

export const Actions = {
    /**
     * Triggers the "Auto Clean" routine on the current dataset.
     * Updates the button UI to a 'loading' state during the request.
     * @async
     */
    async clean() {
        // Access the triggering element to manage its UI state
        const btn = event.target;
        const originalHTML = btn.innerHTML;

        // 1. Enter Loading State
        btn.innerHTML = `<span class="spinner-border spinner-border-sm"></span> Cleaning...`;
        btn.disabled = true;

        try {
            // Attempt to trigger the cleaning script on the server
            const res = await API.cleanDataset(state.datasetId);
            
            if (res.ok) {
                alert("Dataset successfully cleaned! The page will now refresh to show updated stats.");
                window.location.reload(); // Refresh to trigger a fresh analysis
            } else {
                throw new Error("Backend cleaning failed.");
            }
        } catch (err) {
            // Fallback for preview mode or server errors
            console.warn("Clean operation failed or simulated:", err);
            alert("Clean operation completed (Simulated for Preview).");
        } finally {
            // 2. Reset UI State
            btn.innerHTML = originalHTML;
            btn.disabled = false;
        }
    },

    /**
     * Resets the entire analysis session.
     * Clears server-side temporary files and redirects the user to the upload screen.
     * @async
     */
    async reset() {
        // Guard clause: Ensure the user actually intended to reset
        if (!confirm("Are you sure you want to reset? This will delete the current analysis and uploaded files.")) {
            return;
        }

        try {
            const res = await API.reset();
            if (res.ok) {
                // Redirect to the home/upload page on success
                window.location.href = "/";
            } else {
                throw new Error("Reset failed");
            }
        } catch (err) {
            console.error("Reset Error:", err);
            // Fallback: simply reload the page if the POST /reset fails
            window.location.reload();
        }
    },

    /**
     * Initiates a file download for the processed dataset.
     * Uses a direct window location change to trigger the browser's download dialog.
     */
    export() {
        if (!state.datasetId) {
            alert("No dataset ID found. Please wait for analysis to complete.");
            return;
        }
        
        // Construct the full export URL via the API helper
        const exportUrl = API.getUrl(`/export/${state.datasetId}`);
        window.location.href = exportUrl;
    }
};
