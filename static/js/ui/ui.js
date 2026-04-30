/**
 * UI Module
 * Handles visual updates, metric synchronization, and DOM manipulation.
 * Leverages UIEngine and UIRenderer for low-level tasks.
 */
import { state } from "../utils/state.js";
import { Table } from "./table.js";
import { UIEngine } from "./ui.engine.js";
import { UIRenderer } from "./ui.renderer.js";

export const UI = {

    /* =========================================================
       1. BASIC UI SETTERS (NO LOGIC)
    ========================================================= */

    setCurrentFile(name) {
        UIEngine.setText("current-file", name);
    },

    setLoadingState() {
        const ids = [
            "rows", "cols", "duplicates", "quality-score",
            "ml-readiness", "missing-stat", "target-column-display"
        ];

        ids.forEach(id => {
            UIEngine.setText(id, "...");
            UIEngine.setStyle(id, { color: "var(--statIconColor)" });
        });

        // Reset progress bars to 0% during loading for clean transition
        this._updateBar("quality-fill", 0);
        this._updateBar("ml-readiness-fill", 0);

        UIEngine.setHTML("suggestions", `
            <div class="spinner-border spinner-border-sm text-primary"></div> 
            Analyzing dataset patterns...
        `);
    },

    /* =========================================================
       2. STATE → UI RENDERERS (PURE VISUAL UPDATE)
    ========================================================= */

    /**
     * Updates numerical metrics and triggers progress bar animations.
     * @param {Object} data - Dataset analysis results.
     */
    updateMetrics(data) {
        const { summary = {} } = data;

        const applyMetric = (id, value, mode = 'score') => {
            UIEngine.setText(id, value !== undefined ? value : "--");

            const color = UIRenderer.metricColor(value, mode);
            UIEngine.setStyle(id, { color });

            const el = UIEngine.get(id);
            const icon = el?.closest('.stat-card')?.querySelector('.stat-icon');
            if (icon) icon.style.color = color;
        };

        // Standard Numerical Stats
        applyMetric("rows", summary.rows?.toLocaleString(), 'neutral');
        applyMetric("cols", summary.cols, 'neutral');
        applyMetric("duplicates", (summary.duplicatesPercent ?? 0) + "%", 'error');
        applyMetric("missing-stat", (summary.missingPercent ?? 0) + "%", 'error');

        // Scoring Logic
        const qScore = summary.quality_score ?? data.quality_score;
        const mlScore = summary.ml_readiness ?? data.ml_readiness;

        applyMetric("quality-score", qScore, 'score');
        applyMetric("ml-readiness", mlScore, 'score');

        // Trigger Progress Bar Visuals
        this._updateBar("quality-fill", qScore);
        this._updateBar("ml-readiness-fill", mlScore);

        const timeLabel = document.getElementById('scan-time-label');
        if (timeLabel) {
            timeLabel.dataset.timestamp = new Date().toISOString();
            timeLabel.textContent = "Just now";
        }
    },

    updateImbalance(imb) {
        UIEngine.setDisplay("imbalance-alert", imb?.is_imbalanced ? "inline-block" : "none");

        UIEngine.setText(
            "target-column-display",
            imb?.target_column || (imb ? "Not Set" : "Detecting...")
        );

        if (imb?.target_column) {
            UIEngine.setStyle("target-column-display", { color: "var(--primary)" });
        }
    },

    updateSuggestions(list) {
        UIEngine.setHTML("suggestions", UIRenderer.suggestions(list));
    },

    updateOutliers(outliers) {
        UIEngine.setHTML("outliers-list", UIRenderer.outliers(outliers));
    },

    updateStats(data) {
        const tbody = document.getElementById("global-stats-body");
        const thead = document.querySelector("#stats-container thead");
        if (!tbody || !thead) return;

        if (data.status === "processing") {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="stats-loader-container">
                        <div class="stats-loader-content">
                            <div class="spinner-custom"></div>
                            <div class="loader-text">Calculating statistical moments...</div>
                            <div class="loader-subtext">This may take a moment for large datasets</div>
                        </div>
                    </td>
                </tr>`;
            return;
        }

        state.statistics = data.statistics || {};
        state.predictivePower = data.predictive_power || {};

        Table.renderGlobalStats(tbody, thead);
    },

    updateLeakage(leakage) {
        const el = document.getElementById("leakage-section");
        if (!el) return;

        const {
            perfect_predictors: perfect = [],
            high_correlation: highCorr = [],
            duplicate_columns: duplicates = []
        } = leakage || {};

        const hasIssues = perfect.length || highCorr.length || duplicates.length;

        if (!hasIssues) {
            el.innerHTML = this._cleanLeakageHTML();
            if (window.lucide) lucide.createIcons();
            return;
        }

        const isHighRisk = leakage.leakage_risk === "HIGH" || perfect.length > 0;
        const cfg = this._leakageConfig(isHighRisk);

        el.innerHTML = `
            <div class="card leakage-card ${cfg.class} p-4 mb-4"
                 style="border-left: 6px solid ${cfg.accent}; background: ${cfg.bg}; box-shadow: var(--shadow);">
                <div class="d-flex justify-content-between align-items-center mb-3">
                    <h3 class="h5 mb-0 d-flex align-items-center">
                        <i data-lucide="${cfg.headerIcon}" class="me-2"></i>
                        Data Leakage Analysis
                    </h3>
                    <span class="badge ${cfg.badgeClass}">
                        ${leakage.leakage_risk} RISK
                    </span>
                </div>
                <p class="small text-muted mb-3">Detected features that might "cheat" by having access to target info during training.</p>
                <div class="leakage-details">
                    ${this._group("PERFECT PREDICTORS", perfect, "zap-off", "bg-danger", "text-danger")}
                    ${this._group("HIGH CORRELATION (>0.90)", highCorr, cfg.itemIcon, "bg-warning text-dark", cfg.textClass)}
                    ${this._group("DUPLICATE COLUMNS", duplicates, "copy", "bg-secondary", "text-secondary")}
                </div>
                <div class="small mt-3">${cfg.msg}</div>
            </div>`;

        if (window.lucide) lucide.createIcons();
    },

    /* =========================================================
       3. INTERNAL HELPERS (PURE)
    ========================================================= */

    /**
     * Smoothly updates a progress bar width.
     * @param {string} id - The element ID.
     * @param {number} val - The score value (0-100).
     */
   /**
     * Smoothly updates a progress bar width.
     * @param {string} id - The element ID (e.g., 'quality-fill').
     * @param {number} val - The numeric score to represent as a percentage.
     */
    _updateBar(id, val) {
        const el = document.getElementById(id);
        if (!el) return;

        // Ensure the value is a number and clamped between 0 and 100
        const percentage = Math.min(Math.max(Number(val) || 0, 0), 100);

        // Frame synchronization ensures the CSS transition triggers correctly
        requestAnimationFrame(() => {
            el.style.width = `${percentage}%`;
        });
    },

    _leakageConfig(high) {
        return high
            ? {
                class: "border-danger",
                bg: "rgba(239, 68, 68, 0.05)",
                accent: "var(--danger)",
                headerIcon: "alert-octagon",
                itemIcon: "shield-alert",
                textClass: "text-danger",
                badgeClass: "bg-danger",
                msg: "<strong>Critical:</strong> Perfect predictors found. Remove these immediately."
            }
            : {
                class: "border-warning",
                bg: "rgba(245, 158, 11, 0.05)",
                accent: "var(--warning)",
                headerIcon: "search",
                itemIcon: "eye",
                textClass: "text-warning",
                badgeClass: "bg-warning text-dark",
                msg: "<strong>Warning:</strong> High correlation detected. Verify features."
            };
    },

    _group(title, items, icon, badgeCls, textCls) {
        if (!items.length) return '';
        return `
            <div class="mb-3">
                <span class="${textCls} small fw-bold">
                    <i data-lucide="${icon}"></i> ${title}:
                </span>
                <div class="mt-2">
                    ${items.map(i => `<span class="badge ${badgeCls} m-1">${i}</span>`).join("")}
                </div>
            </div>`;
    },

    _cleanLeakageHTML() {
        return `
            <div class="alert alert-success d-flex align-items-center mb-4" 
                 style="border-left: 6px solid var(--success); background: rgba(34, 197, 94, 0.05); padding: 1.25rem; border-radius: var(--radius-lg);">
                <i data-lucide="shield-check" class="me-3" style="width:24px; color: var(--success);"></i> 
                <div style="color: var(--success);">
                    <strong>Data Integrity Verified:</strong> No leakage or redundant predictors detected.
                </div>
            </div>`;
    }
};
