import { state } from "./state.js";
import { API } from "./api.js";
import { UI } from "./ui.js";
import { Charts } from "./charts.js";
import { Table } from "./table.js";

export const Controller = {
    /**
     * Entry point for loading analysis data.
     * Handles polling if the backend is still processing.
     */
    async loadData() {
        try {
            const data = await API.fetchAnalysis(state.datasetId);

            if (data.status === "processing") {
                UI.setLoadingState();
                // Polling: retry every 3s until status is 'ready'
                setTimeout(() => this.loadData(), 3000);
                return;
            }

            // Analysis is finished, render the dashboard
            this.initDashboard(data);
            
        } catch (err) {
            console.error("Dashboard Load Error:", err);
            // Optional: UI.showError("Failed to load dataset analysis.");
        }
    },

    /**
     * Populates all UI components with the analyzed data.
     * Uses asynchronous slicing to handle large (1M+) datasets.
     */
    initDashboard(data) {
        // 1. Sync State
        state.columns = data.columns || [];
        state.outliers = data.outliers || {};

        // 2. Update Fast UI Elements (Text & Metrics)
        // We do these immediately so the user sees results right away
        UI.updateMetrics(data || {});
        UI.updateImbalance(data.imbalance || {});
        UI.updateSuggestions(data.suggestions || []);

        // 3. PRIORITY: Render the Chart (Canvas)
        // We use 0ms to push this to the start of the next browser paint cycle.
        // This prevents the chart from being blocked by heavy table rendering.
        setTimeout(() => {
            if (data.imbalance) {
                console.log("Rendering Chart (Priority Flow)...");
                Charts.renderImbalance(data.imbalance);
            }
        }, 0);

        // 4. DEFER: Heavy Statistics & Table Rendering
        // For 1M rows, parsing stats and building tables is CPU intensive.
        // Waiting 150ms ensures the Chart animation starts smoothly first.
        setTimeout(() => {
            console.log("Rendering heavy stats and tables (Deferred Flow)...");
            UI.updateStats(data.statistics || {});
            UI.updateOutliers(state.outliers);
            
            // Switch to default view
            Table.switch("health");
        }, 150);
    }
};
