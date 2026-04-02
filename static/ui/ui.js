/**
 * UI Controller Module
 * Handles all DOM manipulations, data rendering, and visual state management
 * for the DatasetDoctor dashboard.
 */
export const UI = {
    
    /**
     * Updates the displayed filename in the dashboard header.
     * @param {string} name - The name of the currently active dataset file.
     */
    setCurrentFile(name) {
        const el = document.getElementById("current-file");
        if (el) el.textContent = name;
    },

    /**
     * Sets all metric displays to a loading state ("...").
     * Resets colors to neutral muted state during transition.
     */
    setLoadingState() {
        const ids = ["rows", "cols", "duplicates", "quality-score", "ml-readiness", "missing-stat", "target-column-display"];
        ids.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.textContent = "...";
                el.style.color = "var(--text-main)"; // Reset to default
            }
        });
        
        const suggs = document.getElementById("suggestions");
        if (suggs) {
            suggs.innerHTML = `
                <div class="spinner-border spinner-border-sm text-primary"></div> 
                Analyzing dataset...`;
        }
    },

    /**
     * Populates top-level KPI metrics and handles dynamic color-coding.
     * Logic: 
     * - Quality/Readiness: Green > 80, Orange > 50, Red < 50
     * - Duplicates/Missing: Red > 10, Orange > 5, Blue/Green < 5
     * @param {Object} data - The analysis object containing summary and scoring data.
     */
    updateMetrics(data) {
        const summary = data.summary || {};
        
        /** Internal helper to set text and color based on thresholds */
        const setMetric = (id, val, type = 'score') => {
            const el = document.getElementById(id);
            if (!el) return;
            
            el.textContent = val !== undefined ? val : "--";
            
            const numericVal = parseFloat(val);
            if (isNaN(numericVal)) return;

            if (type === 'score') {
                // Higher is better (Quality Score, ML Readiness)
                if (numericVal >= 80) el.style.color = "var(--success)";
                else if (numericVal >= 50) el.style.color = "var(--warning)";
                else el.style.color = "var(--danger)";
            } else if (type === 'error') {
                // Lower is better (Missing %, Duplicates %)
                if (numericVal > 10) el.style.color = "var(--danger)";
                else if (numericVal > 5) el.style.color = "var(--warning)";
                else el.style.color = "var(--primary)";
            }
        };

        setMetric("rows", summary.rows?.toLocaleString(), 'neutral');
        setMetric("cols", summary.cols, 'neutral');
        setMetric("duplicates", (summary.duplicatesPercent ?? 0) + "%", 'error');
        setMetric("missing-stat", (summary.missingPercent ?? 0) + "%", 'error');
        setMetric("quality-score", summary.quality_score ?? data.quality_score, 'score');
        setMetric("ml-readiness", summary.ml_readiness ?? data.ml_readiness, 'score');
    },

    /**
     * Toggles class imbalance alerts and identifies the target column.
     * @param {Object} imb - Imbalance data object (is_imbalanced, target_column).
     */
    updateImbalance(imb) {
        const alertEl = document.getElementById("imbalance-alert");
        if (alertEl) alertEl.style.display = imb?.is_imbalanced ? "inline-block" : "none";

        const targetEl = document.getElementById("target-column-display");
        if (targetEl) {
            if (!imb || Object.keys(imb).length === 0) {
                targetEl.textContent = "Analyzing...";
            } else {
                targetEl.textContent = imb.target_column || "Not Set";
                targetEl.style.color = "var(--primary)";
            }
        }
    },

    /**
     * Renders the list of AI-generated cleanup suggestions.
     */
    updateSuggestions(list) {
        const el = document.getElementById("suggestions");
        if (!el) return;
        
        el.innerHTML = list?.length 
            ? list.map(s => `<div class="suggestion-item"><span>💡</span> ${s}</div>`).join("")
            : `<p class="text-muted">No suggestions at this time.</p>`;
    },

    /**
     * Renders warning tags for columns containing statistical outliers.
     */
    updateOutliers(outliers) {
        const el = document.getElementById("outliers-list");
        if (!el) return;
        
        const cols = Object.keys(outliers || {}).filter(k => outliers[k].count > 0);
        el.innerHTML = cols.length
            ? cols.map(name => `<span class="issue-tag">⚠️ Outliers: ${name}</span>`).join("")
            : `<span class="badge" style="background:#dcfce7; color:#166534">✅ No Critical Issues</span>`;
    },

    /**
     * Renders a detailed statistical table for numerical features.
     */
    updateStats(incomingData, powerData) {
        const tbody = document.getElementById("global-stats-body");
        const thead = document.querySelector("#stats-container thead"); // Target thead inside stats
        if (!tbody || !thead) return;

        if (incomingData.status === "processing") {
	    tbody.innerHTML = `
		<tr>
		    <td colspan="5" class="stats-loader-container">
		        <div class="stats-loader-content">
		            <div class="spinner-custom"></div>
		            <div class="loader-text">Calculating statistical moments...</div>
		            <div class="loader-subtext">Mapping feature distributions</div>
		        </div>
		    </td>
		</tr>`;
	    return;
	}

        // 1. Sync the global state first so Table.js can see it
        import("./state.js").then(m => {
            // ONLY pick the statistics part for state.statistics
            m.state.statistics = incomingData.statistics || {};
        
           // ONLY pick the predictive_power part for state.predictivePower
           m.state.predictivePower = incomingData.predictive_power || {};
            
            // 2. Delegate the actual table rendering to the Table module
            import("./table.js").then(t => {
                t.Table.renderGlobalStats(tbody, thead);
            });
        });
    },
    
    
    
    /**
     * Analyzes and displays potential Data Leakage risks using Lucide icons.
     * Maps risk levels to specific colors, icons, and recommendation text.
     */
    updateLeakage(leakage) {
        const el = document.getElementById("leakage-section");
        if (!el) return;

        const perfect = leakage?.perfect_predictors || [];
        const highCorr = leakage?.high_correlation || [];
        const duplicates = leakage?.duplicate_columns || [];
        const hasIssues = perfect.length > 0 || highCorr.length > 0 || duplicates.length > 0;

        // --- CLEAN STATE ---
        if (!hasIssues) {
            el.innerHTML = `
                <div class="alert alert-success d-flex align-items-center mb-4" 
                     style="border-left: 6px solid var(--success); background: #f0fdf4; padding: 1.25rem; border-radius: var(--radius-lg);">
                    <i data-lucide="shield-check" class="me-3" style="width:24px; color: var(--success);"></i> 
                    <div style="color: #166534;">
                        <strong>Data Integrity Verified:</strong> No leakage or perfect predictors found.
                    </div>
                </div>`;
            lucide.createIcons();
            return;
        }

        // --- RISK LOGIC & CONFIG ---
        const isHighRisk = leakage.leakage_risk === "HIGH" || perfect.length > 0;
        
        const config = isHighRisk 
            ? { 
                class: "border-danger", 
                bg: "#fff5f5", 
                accent: "var(--danger)", 
                headerIcon: "alert-octagon",
                itemIcon: "shield-alert",
                textClass: "text-danger",
                badgeClass: "bg-danger",
                msg: "<strong>Critical:</strong> Remove perfect predictors immediately to prevent over-optimistic results."
              }
            : { 
                class: "border-warning", 
                bg: "#fffdf5", 
                accent: "var(--warning)", 
                headerIcon: "search",
                itemIcon: "eye",
                textClass: "text-warning-dark",
                badgeClass: "bg-warning text-dark",
                msg: "<strong>Notice:</strong> Review high-correlation features. They may contain future information."
              };

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

                <p class="text-muted small mb-4">Detected features that might "cheat" by having access to target info during training.</p>

                <div class="leakage-details">
                    ${perfect.length ? `
                        <div class="mb-3">
                            <span class="text-danger small fw-bold d-flex align-items-center gap-1">
                                <i data-lucide="zap-off" style="width:14px"></i> PERFECT PREDICTORS:
                            </span>
                            <div class="mt-2">
                                ${perfect.map(p => `<span class="badge bg-danger m-1">${p}</span>`).join("")}
                            </div>
                        </div>` : ''}

                    ${highCorr.length ? `
                        <div class="mb-3">
                            <span class="${config.textClass} small fw-bold d-flex align-items-center gap-1">
                                <i data-lucide="${config.itemIcon}" style="width:14px"></i> HIGH CORRELATION (>0.90):
                            </span>
                            <div class="mt-2">
                                ${highCorr.map(p => `<span class="badge bg-warning text-dark m-1" style="border: 1px solid rgba(0,0,0,0.1)">${p}</span>`).join("")}
                            </div>
                        </div>` : ''}

                    ${duplicates.length ? `
                        <div class="mb-1">
                            <span class="text-secondary small fw-bold d-flex align-items-center gap-1">
                                <i data-lucide="copy" style="width:14px"></i> DUPLICATE COLUMNS:
                            </span>
                            <div class="mt-2">
                                ${duplicates.map(p => `<span class="badge bg-secondary m-1">${p}</span>`).join("")}
                            </div>
                        </div>` : ''}
                </div>

                <hr class="my-4" style="opacity: 0.1; border-color: var(--text-main);">
                
                <div class="recommendation small d-flex align-items-start gap-2" style="color: var(--text-muted); line-height: 1.4;">
                    <i data-lucide="info" style="width:16px; margin-top: 2px; color: ${config.accent}"></i>
                    <span>${config.msg}</span>
                </div>
            </div>
        `;

        // Re-initialize icons to render the newly injected data-lucide tags
        lucide.createIcons();
    },
};
