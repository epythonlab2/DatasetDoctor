/**
 * Controller Module
 * Acts as the orchestrator between the API, State, and UI components.
 * Manages data fetching, polling, and prioritized rendering logic.
 */
import { state } from "./state.js";
import { API } from "./api.js";
import { UI } from "./ui.js";
import { Charts } from "./charts.js";
import { Table } from "./table.js";

export const Controller = {
    /**
     * Entry point for loading analysis data.
     * Implements a polling mechanism: if the backend is still processing,
     * it schedules a retry. Once ready, it triggers the dashboard initialization.
     * @async
     */
    async loadData() {
        try {
            // Request dataset analysis from the API layer
            const data = await API.fetchAnalysis(state.datasetId);

            // Handle incomplete analysis via recursive polling
            if (data.status === "processing") {
                UI.setLoadingState();
                
                // Retry every 3 seconds until status is 'ready'
                setTimeout(() => this.loadData(), 3000);
                return;
            }

            // Analysis is complete; transition to dashboard rendering
            this.initDashboard(data);
            
        } catch (err) {
            console.error("Dashboard Load Error:", err);
            // Error handling could be extended here to show a UI error toast
        }
    },

    /**
     * Orchestrates the population of all UI components with analyzed data.
     * Utilizes a "Tiered Rendering" strategy to maintain 60FPS UI performance:
     * 1. Fast Metrics (Immediate)
     * 2. Visual Charts (Priority Queue)
     * 3. Heavy Data Tables (Deferred)
     * @param {Object} data - The complete analysis payload from the backend.
     */
    initDashboard(data) {
        // --- TIER 1: STATE SYNC & FAST UI ---
        // Synchronize core data to the global state object
        state.columns = data.columns || [];
        state.outliers = data.outliers || {};

        // Update text-based elements immediately (Zero heavy computation)
        UI.updateMetrics(data || {});
        UI.updateImbalance(data.imbalance || {});
        UI.updateSuggestions(data.suggestions || []);
        
        // Render data leakage warnings early as they are critical for the user
        UI.updateLeakage(data.leakage || {});

        // --- TIER 2: PRIORITY RENDERING ---
        // Use a 0ms timeout to push Chart rendering to the next event loop tick.
        // This allows the browser to perform an initial paint of the text metrics first.
        setTimeout(() => {
            if (data.imbalance) {
                Charts.renderImbalance(data.imbalance);
            }
        }, 0);

        // --- TIER 3: DEFERRED RENDERING ---
        // Large datasets (1M+ rows) generate massive statistical objects.
        // Parsing these and injecting hundreds of DOM nodes into a table is expensive.
        // A 150ms delay ensures Tier 1 & 2 are visually stable before the CPU spikes.
        setTimeout(() => {
            console.log("Processing heavy statistical tables...");
           
            // Populate the detailed stats table
            UI.updateStats(data);
            
            
            // Populate the outlier list derived from state
            UI.updateOutliers(state.outliers);
            
            // Default the diagnostics table view to 'Missing Data'
            Table.switch("health");
        }, 150);
    }
};
