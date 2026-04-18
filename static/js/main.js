/**
 * Entry Point: Dataset Analysis Dashboard
 * Coordinates the polling logic, state initialization, and UI distribution.
 */

import { state } from "./utils/state.js";
import { Controller } from "./ui/controller.js";
import { UI } from "./ui/ui.js";
import { Table } from "./ui/table.js";
import { Actions } from "./ui/actions.js";

/**
 * Orchestrates the recursive polling loop.
 * Fetches data via the Controller and distributes it to UI components 
 * once the backend status moves from 'processing' to 'ready'.
 */
async function startAnalysisPolling() {
    const id = getDatasetId();
    state.datasetId = id;

    try {
        // Request the latest analysis state from the Controller
        const data = await Controller.loadData();

        // Case 1: Backend is still computing (Plugins are still running)
        if (data && data.status === "processing") {
            console.log("Analysis in progress... polling again in 2s");
            
            // Show partial stats if available to improve perceived performance
            UI.updateStats(data); 
            
            // Recursive call after 2-second delay
            setTimeout(startAnalysisPolling, 2000);
        } 
        
        // Case 2: Analysis complete
        else if (data && data.status === "ready") {
            console.log("Analysis ready. Distributing data to UI modules.");

            // 1. Update KPI counters (Rows, Cols, Quality Score)
            UI.updateMetrics(data);
            
            // Set visual placeholders immediately to improve UX
    	    UI.setCurrentFile(data.filename);
            
            // 2. Render the Data Leakage diagnostic card
            UI.updateLeakage(data.leakage);
            
            // 3. Update Target Column info and Imbalance status
            UI.updateImbalance(data.imbalance);
            
            // 4. Inject AI-generated cleanup suggestions
            UI.updateSuggestions(data.suggestions);
            
            // 5. Populate outlier warning tags
            UI.updateOutliers(data.outliers);
            
            // 6. Build the detailed descriptive statistics table
            UI.updateStats(data.statistics);

            // Finalize: Re-scan DOM for new icons injected by the update functions
            lucide.createIcons(); 
        }
    } catch (err) {
        console.error("Polling failed:", err);
        // Fallback: notify user of the connection/parsing error
    }
}

/**
 * Extracts the Dataset UUID from the URL path.
 * Fallback to 'preview-dataset' if no ID is found or if in dashboard root.
 * @returns {string} The dataset identifier.
 */
function getDatasetId() {
    const parts = window.location.pathname.split("/");
    let id = parts[parts.length - 1];

    // Validate ID; handle edge cases for dashboard home or blob previews
    if (!id || id === "dashboard" || id.includes("blob:")) {
        id = "preview-dataset";
    }
    return id;
}

/**
 * Initialization: Runs when the DOM is fully loaded.
 */
document.addEventListener("DOMContentLoaded", () => {
    // Initial icon render for static HTML elements
    lucide.createIcons();

    
    UI.setLoadingState(); 

    // Kick off the data retrieval process
    startAnalysisPolling();
});


/**
 * Global Exports
 * Maps internal module methods to the 'window' object to allow 
 * access from inline HTML 'onclick' attributes.
 */
window.switchTableTab = Table.switch;
//window.cleanDataset = Actions.clean;
// Instead of: window.resetAnalysis = Actions.reset;
// Use a wrapper function:
window.resetAnalysis = async () => {
    try {
        await Actions.reset();
    } catch (err) {
        console.error("Global Reset Handler Error:", err);
        // Force a home redirect even if the API call fails
        window.location.href = "/";
    }
};
window.exportDataset = Actions.export;

window.onload = () => {
    const params = new URLSearchParams(window.location.search);

    if (params.get('error') === 'session_expired') {
        // 1. Notify the user
        alert("Your session has expired or the dataset was not found. Redirecting to reset...");

        // 2. Execute the full reset flow
        if (typeof window.resetAnalysis === 'function') {
            window.resetAnalysis().catch(err => {
                console.error("Reset failed, forcing home:", err);
                window.location.href = "/";
            });
        } else {
            // Fallback if the Actions module isn't loaded/mapped yet
            localStorage.clear();
            window.location.replace("/");
        }
    }
};
