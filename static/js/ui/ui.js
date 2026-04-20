// ui.js

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

    UIEngine.setHTML("suggestions", `
      <div class="spinner-border spinner-border-sm text-primary"></div> 
      Analyzing dataset patterns...
    `);
  },

  /* =========================================================
     2. STATE → UI RENDERERS (PURE VISUAL UPDATE)
  ========================================================= */

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

    applyMetric("rows", summary.rows?.toLocaleString(), 'neutral');
    applyMetric("cols", summary.cols, 'neutral');
    applyMetric("duplicates", (summary.duplicatesPercent ?? 0) + "%", 'error');
    applyMetric("missing-stat", (summary.missingPercent ?? 0) + "%", 'error');
    applyMetric("quality-score", summary.quality_score ?? data.quality_score, 'score');
    applyMetric("ml-readiness", summary.ml_readiness ?? data.ml_readiness, 'score');

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

    // ✅ STATE UPDATE (kept, but now clearly isolated)
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
          <p>Detected features that might "cheat" by having access to target info during training</p>
        </div>

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

  _leakageConfig(high) {
    return high
      ? {
          class: "border-danger",
          bg: "#fff5f5",
          accent: "var(--danger)",
          headerIcon: "alert-octagon",
          itemIcon: "shield-alert",
          textClass: "text-danger",
          badgeClass: "bg-danger",
          msg: "<strong>Critical:</strong> Perfect predictors found. Remove these immediately to prevent data leakage."
        }
      : {
          class: "border-warning",
          bg: "#fffdf5",
          accent: "var(--warning)",
          headerIcon: "search",
          itemIcon: "eye",
          textClass: "text-warning-dark",
          badgeClass: "bg-warning text-dark",
          msg: "<strong>Warning:</strong> High correlation detected. Verify these features aren't 'cheating' by looking ahead."
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

  /** Private Helper: Clean Leakage UI */

    _cleanLeakageHTML() {

        return `

            <div class="alert alert-success d-flex align-items-center mb-4" 

                 style="border-left: 6px solid var(--success); background: #f0fdf4; padding: 1.25rem; border-radius: var(--radius-lg);">

                <i data-lucide="shield-check" class="" style="width:24px; color: var(--success);"></i> 

                <div style="color: #166534;">

                    <strong>Data Integrity Verified:</strong> No leakage or redundant predictors detected.

                </div>

            </div>`;
  }
};
