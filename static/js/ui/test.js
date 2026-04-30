/**
 * Charts Module
 * Handles the initialization and lifecycle of Chart.js instances for the dashboard.
 * Requires the Chart.js library to be loaded globally.
 */
import { state } from "../utils/state.js";

export const Charts = {
    /**
     * Renders a minimalist Bar chart representing target class distribution.
     * Features: Descending sort, hidden X-axis labels for SaaS aesthetic, and auto-retry.
     * 
     * @param {Object} imb - The imbalance data object.
     * @param {Object} imb.distribution - Key-value pairs of class names and their counts.
     * @returns {void}
     */
    renderImbalance(imb) {
        const canvas = document.getElementById("imbalanceChart");
        
        // 1. ASYNC SAFETY CHECK: Retry if DOM is not ready
        if (!canvas) {
            setTimeout(() => this.renderImbalance(imb), 50);
            return;
        }

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        // 2. DATA PROCESSING: Sort descending for professional visual hierarchy
        const dist = imb?.distribution || {};
        const sortedData = Object.entries(dist)
            .map(([label, value]) => ({ label, value }))
            .sort((a, b) => b.value - a.value);

        const labels = sortedData.map(item => item.label);
        const values = sortedData.map(item => item.value);

        if (labels.length === 0) return;

        // 3. LIFECYCLE MANAGEMENT: Clean up old instances
        if (state.charts.imbalance) {
            state.charts.imbalance.destroy();
        }

        /**
         * Create the Bar Chart instance.
         * Configuration emphasizes a clean, "Glass-on-Black" high-contrast look.
         */
        state.charts.imbalance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    label: 'Class count',
                    data: values,
                    backgroundColor: ['#6366f1', '#818cf8', '#c7d2fe'], // User brand primary
                    borderRadius: 6,
                    borderSkipped: false,
                    barThickness: 'flex',
                    maxBarThickness: 40
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }, // Minimalist look: no legend
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.9)',
                        titleFont: { size: 13, weight: '600' },
                        padding: 12,
                        cornerRadius: 8,
                        callbacks: {
                            label: (context) => {
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const val = context.raw;
                                const pct = ((val / total) * 100).toFixed(1);
                                return ` ${context.label}: ${val.toLocaleString()} (${pct}%)`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Class Name',
                            color: '#8e8e93',
                            font: { size: 10, weight: '600' }
                        },
                        grid: { display: false },
                        ticks: { 
                            display: true, // Labels now visible
                            color: '#8e8e93',
                            font: { size: 10 },
                            maxRotation: 45,
                            minRotation: 0
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Frequency',
                            color: '#8e8e93',
                            font: { size: 10, weight: '600' }
                        },
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(255, 255, 255, 0.05)',
                            drawBorder: false
                        },
                        ticks: {
                            color: '#8e8e93',
                            font: { size: 10 },
                            maxTicksLimit: 5
                        }
                    }
                }
            }
        });
    }
};
