/**
 * UI Controller Module
 * * Orchestrates DOM manipulations and data rendering for the DatasetDoctor dashboard.
 * Designed with a focus on visual performance and clear feedback loops.
 * * @module UI
 */

import { state } from "./state.js";
import { Table } from "./table.js";

export const UI = {
    /**
     * Updates the displayed filename in the dashboard header.
     * @param {string} name - Active dataset filename.
     */
    setCurrentFile(name) {
        const el = document.getElementById("current-file");
        if (el) el.textContent = name;
    },

    /**
     * Resets all KPI metrics to a loading state.
     * Use this before starting a new analysis fetch to provide visual feedback.
     */
    setLoadingState() {
        const kpiIds = [
            "rows", "cols", "duplicates", "quality-score", 
            "ml-readiness", "missing-stat", "target-column-display"
        ];

        kpiIds.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.textContent = "...";
                el.style.color = "var(--statIconColor)";
            }
        });

        const suggestionsEl = document.getElementById("suggestions");
        if (suggestionsEl) {
            suggestionsEl.innerHTML = `
                <div class="spinner-border spinner-border-sm text-primary"></div> 
                Analyzing dataset patterns...`;
        }
    },

    /**
     * Updates top-level KPI metrics with semantic color coding.
     * * Threshold Logic:
     * - Score: Green (>=80), Amber (>=50), Red (<50)
     * - Error: Red (>10%), Amber (>5%), Blue (<=5%)
     * * @param {Object} data - Analysis payload.
     */
   /**
     * Updates top-level KPI metrics and resets the session-based scan timer.
     * Note: Timer will reset on page refresh as localStorage is disabled.
     */
    updateMetrics(data) {
        const { summary = {} } = data;

        const applyMetric = (id, value, mode = 'score') => {
            const el = document.getElementById(id);
            if (!el) return;

            el.textContent = value !== undefined ? value : "--";
            const num = parseFloat(value);
            if (isNaN(num)) return;

            let color = "var(--primary)";
            if (mode === 'score') {
                color = num >= 80 ? "var(--success)" : (num >= 50 ? "var(--warning)" : "var(--danger)");
            } else if (mode === 'error') {
                color = num > 10 ? "var(--danger)" : (num > 5 ? "var(--warning)" : "var(--primary)");
            }

            el.style.color = color;
            const icon = el.closest('.stat-card')?.querySelector('.stat-icon');
            if (icon) icon.style.color = color;
        };

        // Render Values
        applyMetric("rows", summary.rows?.toLocaleString(), 'neutral');
        applyMetric("cols", summary.cols, 'neutral');
        applyMetric("duplicates", (summary.duplicatesPercent ?? 0) + "%", 'error');
        applyMetric("missing-stat", (summary.missingPercent ?? 0) + "%", 'error');
        applyMetric("quality-score", summary.quality_score ?? data.quality_score, 'score');
        applyMetric("ml-readiness", summary.ml_readiness ?? data.ml_readiness, 'score');
        
        // --- Reset Timer (Session Only) ---
        const timeLabel = document.getElementById('scan-time-label');
        if (timeLabel) {
            timeLabel.dataset.timestamp = new Date().toISOString();
            timeLabel.textContent = "Just now";
        }
    },

    /**
     * Manages Class Imbalance alerts and target feature identification.
     * @param {Object} imb - Imbalance metadata.
     */
    updateImbalance(imb) {
        const alert = document.getElementById("imbalance-alert");
        if (alert) alert.style.display = imb?.is_imbalanced ? "inline-block" : "none";

        const target = document.getElementById("target-column-display");
        if (!target) return;

        if (!imb || Object.keys(imb).length === 0) {
            target.textContent = "Detecting...";
        } else {
            target.textContent = imb.target_column || "Not Set";
            target.style.color = "var(--primary)";
        }
    },

    /**
     * Renders AI-driven cleanup suggestions.
     * @param {string[]} list - Array of suggestion strings.
     */
    updateSuggestions(list) {
        const el = document.getElementById("suggestions");
        if (!el) return;

        el.innerHTML = list?.length
            ? list.map(s => `<div class="suggestion-item"><span>💡</span> ${s}</div>`).join("")
            : `<p class="text-muted">No specific cleanup tasks identified.</p>`;
    },

    /**
     * Renders column-specific outlier warnings.
     * @param {Object} outliers - Key-value pair of column names and outlier counts.
     */
    updateOutliers(outliers) {
        const el = document.getElementById("outliers-list");
        if (!el) return;

        const problematicCols = Object.keys(outliers || {}).filter(k => outliers[k].count > 0);

        el.innerHTML = problematicCols.length
            ? problematicCols.map(name => `<span class="issue-tag">⚠️ Outliers: ${name}</span>`).join("")
            : `<span class="badge" style="background:#dcfce7; color:#166534">✅ Statistical Distribution Normal</span>`;
    },

    /**
     * Orchestrates the population of the global statistics table.
     * Synchronizes local data with global state before triggering the Table module.
     * * @param {Object} data - Primary analysis data.
     */
    updateStats(data) {
        const tbody = document.getElementById("global-stats-body");
        const thead = document.querySelector("#stats-container thead");
        if (!tbody || !thead) return;

        // Show specialized loader for statistical processing
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

        // Sync State
        state.statistics = data.statistics || {};
        state.predictivePower = data.predictive_power || {};

        // Execute render via Table module
        Table.renderGlobalStats(tbody, thead);
    },

    /**
     * Renders the Data Leakage Analysis section.
     * Dynamically configures the UI based on risk severity (HIGH vs LOW/MODERATE).
     * * @param {Object} leakage - Leakage detection results.
     */
    updateLeakage(leakage) {
        const el = document.getElementById("leakage-section");
        if (!el) return;

        const { perfect_predictors: perfect = [], high_correlation: highCorr = [], duplicate_columns: duplicates = [] } = leakage || {};
        const hasIssues = perfect.length > 0 || highCorr.length > 0 || duplicates.length > 0;

        if (!hasIssues) {
            el.innerHTML = this._generateCleanLeakageHTML();
            if (window.lucide) lucide.createIcons();
            return;
        }

        const isHighRisk = leakage.leakage_risk === "HIGH" || perfect.length > 0;
        const config = this._getLeakageConfig(isHighRisk);

        el.innerHTML = `
            <div class="card leakage-card ${config.class} p-4 mb-4" 
                 style="border-left: 6px solid ${config.accent}; background: ${config.bg}; box-shadow: var(--shadow);">
                
                <div class="d-flex justify-content-between align-items-center mb-3">
                    <h3 class="h5 mb-0 d-flex align-items-center" style="color: var(--text-main); font-weight: 700;">
                        <i data-lucide="${config.headerIcon}" class="me-2" style="width:20px; color: ${config.accent}"></i>
                        Data Leakage Analysis
                    </h3>
                    <span class="badge ${config.badgeClass} px-3 py-2" style="font-weight: 700;">
                        ${leakage.leakage_risk} RISK
                    </span>
                </div>

                <p class="text-muted small mb-4">Detected features that may inappropriately expose target information during training.</p>

                <div class="leakage-details">
                    ${this._renderLeakageGroup("PERFECT PREDICTORS", perfect, "zap-off", "bg-danger", "text-danger")}
                    ${this._renderLeakageGroup("HIGH CORRELATION (>0.90)", highCorr, config.itemIcon, "bg-warning text-dark", config.textClass)}
                    ${this._renderLeakageGroup("DUPLICATE COLUMNS", duplicates, "copy", "bg-secondary", "text-secondary")}
                </div>

                <hr class="my-4" style="opacity: 0.1; border-color: var(--text-main);">
                
                <div class="recommendation small d-flex align-items-start gap-2" style="color: var(--text-muted); line-height: 1.4;">
                    <i data-lucide="info" style="width:16px; margin-top: 2px; color: ${config.accent}"></i>
                    <span>${config.msg}</span>
                </div>
            </div>`;

        if (window.lucide) lucide.createIcons();
    },

    /** Private Helper: Leakage Configuration */
    _getLeakageConfig(isHighRisk) {
        return isHighRisk ? {
            class: "border-danger", bg: "#fff5f5", accent: "var(--danger)",
            headerIcon: "alert-octagon", itemIcon: "shield-alert",
            textClass: "text-danger", badgeClass: "bg-danger",
            msg: "<strong>Critical:</strong> Perfect predictors found. Remove these immediately to prevent data leakage."
        } : {
            class: "border-warning", bg: "#fffdf5", accent: "var(--warning)",
            headerIcon: "search", itemIcon: "eye",
            textClass: "text-warning-dark", badgeClass: "bg-warning text-dark",
            msg: "<strong>Warning:</strong> High correlation detected. Verify these features aren't 'cheating' by looking ahead."
        };
    },

    /** Private Helper: Render Leakage Group */
    _renderLeakageGroup(title, items, icon, badgeCls, textCls) {
        if (!items.length) return '';
        return `
            <div class="mb-3">
                <span class="${textCls} small fw-bold d-flex align-items-center gap-1">
                    <i data-lucide="${icon}" style="width:14px"></i> ${title}:
                </span>
                <div class="mt-2">
                    ${items.map(item => `<span class="badge ${badgeCls} m-1">${item}</span>`).join("")}
                </div>
            </div>`;
    },

    /** Private Helper: Clean Leakage UI */
    _generateCleanLeakageHTML() {
        return `
            <div class="alert alert-success d-flex align-items-center mb-4" 
                 style="border-left: 6px solid var(--success); background: #f0fdf4; padding: 1.25rem; border-radius: var(--radius-lg);">
                <i data-lucide="shield-check" class="me-3" style="width:24px; color: var(--success);"></i> 
                <div style="color: #166534;">
                    <strong>Data Integrity Verified:</strong> No leakage or redundant predictors detected.
                </div>
            </div>`;
    }
};
