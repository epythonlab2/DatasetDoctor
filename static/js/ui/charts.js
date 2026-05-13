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
    if (!canvas) {
        setTimeout(() => this.renderImbalance(imb), 50);
        return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dist = imb?.distribution || {};
    const sortedData = Object.entries(dist)
        .map(([label, value]) => ({ label, value }))
        .sort((a, b) => b.value - a.value);

    const labels = sortedData.map(item => item.label);
    const values = sortedData.map(item => item.value);

    if (labels.length === 0) return;

    if (state.charts.imbalance) {
        state.charts.imbalance.destroy();
    }

    // --- NEW: Custom Plugin for Top-Right Imbalance Text ---
    const imbalanceTextPlugin = {
        id: 'imbalanceText',
        afterDraw: (chart) => {
            if (imb?.is_imbalanced) {
                const { ctx, chartArea: { top, right } } = chart;
                const severity = imb.imbalance_severity || "Detected";
                
                ctx.save();
                ctx.textAlign = 'right';
                ctx.textBaseline = 'top';
                ctx.font = 'bold 11px sans-serif';
                
                // Set color based on severity (SaaS aesthetic)
                ctx.fillStyle = imb.imbalance_severity?.toLowerCase() === 'high' 
                    ? '#ff453a'  // Apple/SaaS Danger Red
                    : '#ff9f0a'; // Apple/SaaS Warning Orange

                // Draw the text with a small padding from the top-right corner
                ctx.fillText(`${severity.toUpperCase()} CLASS IMBALANCE`, right - 10, top + 10);
                ctx.restore();
            }
        }
    };

    state.charts.imbalance = new Chart(ctx, {
        type: 'bar',
        plugins: [imbalanceTextPlugin], // Register the custom plugin here
        data: {
            labels,
            datasets: [{
                label: 'Class count',
                data: values,
                backgroundColor: ['#6366f1', '#818cf8', '#c7d2fe'],
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
                legend: { display: false }, 
                tooltip: {
                    // ... your existing tooltip config
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
                    ticks: { color: '#8e8e93', font: { size: 10 } }
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


