/**
 * Controller Module
 * Orchestrates the flow of data between the API, the global State, and the UI.
 * Handles recursive polling for long-running analyses and implements tiered rendering
 * to ensure a smooth 60FPS user experience.
 */
import { state } from "./state.js";
import { API } from "./api.js";
import { UI } from "./ui.js";
import { Charts } from "./charts.js";
import { Table } from "./table.js";

export const Controller = {
    // Tracks if the previous poll was in a processing state
    wasProcessing: false,

    /**
     * Entry point for loading dataset analysis.
     * Implements a polling mechanism for 'processing' states and manages
     * persistent scan timestamps.
     * @async
     */
    async loadData() {
        try {
            const data = await API.fetchAnalysis(state.datasetId);

            // 1. Handle Polling Logic
            if (data.status === "processing") {
                this.wasProcessing = true;
                UI.setLoadingState();
                
                // Retry every 3 seconds
                setTimeout(() => this.loadData(), 3000);
                return;
            }
            // Set the filename IMMEDIATELY
	     if (data.filename) {
		   UI.setCurrentFile(data.filename);
	     }

            // 2. Data is Ready - Initialize Dashboard
            this.initDashboard(data);

        } catch (err) {
            console.error("Dashboard Load Error:", err);
            // Optional: UI.showErrorToast("Failed to load analysis data.");
        }
    },

  
    /**
     * Orchestrates UI population using a "Tiered Rendering" strategy.
     * This prevents the main thread from locking up during heavy data processing.
     * @param {Object} data - The complete analysis payload.
     */
    initDashboard(data) {
        // --- TIER 1: IMMEDIATE (State & Fast UI) ---
        // Sync critical data to global state
        state.columns = data.columns || [];
        state.outliers = data.outliers || {};

        // Render fast, text-based elements
        UI.updateMetrics(data || {});
        UI.updateImbalance(data.imbalance || {});
        UI.updateSuggestions(data.suggestions || []);
        UI.updateLeakage(data.leakage || {});

        // --- TIER 2: PRIORITY (Charts) ---
        // Deferred to the next event loop tick to allow TIER 1 to paint first.
        setTimeout(() => {
            if (data.imbalance) {
                Charts.renderImbalance(data.imbalance);
            }
        }, 0);

        // --- TIER 3: DEFERRED (Heavy Tables) ---
        // Parsing 1M+ row statistics can be expensive. 
        // 150ms delay ensures the UI is interactive before the CPU spike.
        setTimeout(() => {
            console.log("Rendering heavy statistical components...");
            
            UI.updateStats(data);
            UI.updateOutliers(state.outliers);
            
            // Set default view for diagnostics
            Table.switch("health");
        }, 150);
    }
};
