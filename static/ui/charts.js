import { state } from "./state.js";

export const Charts = {
    /**
     * Renders a Doughnut chart for class distribution.
     * Includes a safety check to ensure the DOM element exists.
     */
    renderImbalance(imb) {
        const canvas = document.getElementById("imbalanceChart");
        
        // 1. Check if canvas exists. If not, the DOM might still be loading.
        if (!canvas) {
            console.warn("imbalanceChart canvas not found. Retrying in 50ms...");
            setTimeout(() => this.renderImbalance(imb), 50);
            return;
        }

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        // 2. Data Validation: Ensure imb and distribution exist
        const dist = imb?.distribution || {};
        const labels = Object.keys(dist);
        const values = Object.values(dist);

        if (labels.length === 0) {
            console.warn("No distribution data available for imbalance chart.");
            return;
        }

        // 3. Clean up existing chart instance to prevent memory leaks/overlap
        if (state.charts.imbalance) {
            state.charts.imbalance.destroy();
        }

        // 4. Initialize Chart
        state.charts.imbalance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels,
                datasets: [{
                    data: values,
                    backgroundColor: [
                        '#1a5fb4', // Dark Blue
                        '#3584e4', // Mid Blue
                        '#62a0ea', // Light Blue
                        '#94bcff'  // Soft Blue
                    ],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '75%',
                plugins: {
                    legend: { 
                        position: 'bottom', 
                        labels: { 
                            usePointStyle: true,
                            padding: 20
                        } 
                    },
                    tooltip: {
                        enabled: true,
                        callbacks: {
                            label: (context) => {
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const val = context.raw;
                                const pct = ((val / total) * 100).toFixed(1);
                                return ` ${context.label}: ${val} (${pct}%)`;
                            }
                        }
                    }
                }
            }
        });
    }
};
