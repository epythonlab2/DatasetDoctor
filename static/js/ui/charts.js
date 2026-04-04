/**
 * Charts Module
 * Handles the initialization and lifecycle of Chart.js instances.
 * Requires the Chart.js library to be loaded globally.
 */
import { state } from "./state.js";

export const Charts = {
    /**
     * Renders a Doughnut chart representing the distribution of target classes.
     * Includes a self-correcting retry mechanism if the DOM is not yet ready.
     * * @param {Object} imb - Imbalance data object containing the distribution mapping.
     */
    renderImbalance(imb) {
        const canvas = document.getElementById("imbalanceChart");
        
        // 1. ASYNC SAFETY CHECK: 
        // If the canvas isn't in the DOM yet, we retry after a short delay.
        // This is useful when the analysis finishes faster than the page transition.
        if (!canvas) {
            console.warn("imbalanceChart canvas not found. Retrying in 50ms...");
            setTimeout(() => this.renderImbalance(imb), 50);
            return;
        }

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        // 2. DATA EXTRACTION:
        // Expected format of imb.distribution: { "Class A": 800, "Class B": 200 }
        const dist = imb?.distribution || {};
        const labels = Object.keys(dist);
        const values = Object.values(dist);

        // Fail gracefully if no distribution data is present
        if (labels.length === 0) {
            console.warn("No distribution data available for imbalance chart.");
            return;
        }

        // 3. LIFECYCLE MANAGEMENT:
        // Chart.js requires existing instances to be destroyed before re-using a canvas.
        // This prevents visual "ghosting" when hovering over new charts.
        if (state.charts.imbalance) {
            state.charts.imbalance.destroy();
        }

        /**
         * Create the Doughnut Chart instance.
         * Configuration focuses on a clean, modern look using a blue color palette.
         */
        state.charts.imbalance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels,
                datasets: [{
                    data: values,
                    backgroundColor: [
                        '#1a5fb4', // Dark Blue (Primary)
                        '#3584e4', // Mid Blue
                        '#62a0ea', // Light Blue
                        '#94bcff'  // Soft Blue
                    ],
                    borderWidth: 0,
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '75%', // Creates the "Ring" look
                plugins: {
                    legend: { 
                        position: 'bottom', 
                        labels: { 
                            usePointStyle: true, // Circles instead of rectangles
                            padding: 20,
                            font: { size: 12 }
                        } 
                    },
                    tooltip: {
                        enabled: true,
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        padding: 12,
                        callbacks: {
                            /**
                             * Custom tooltip label to show both the raw count and percentage.
                             */
                            label: (context) => {
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const val = context.raw;
                                const pct = ((val / total) * 100).toFixed(1);
                                return ` ${context.label}: ${val.toLocaleString()} (${pct}%)`;
                            }
                        }
                    }
                }
            }
        });
    }
};
