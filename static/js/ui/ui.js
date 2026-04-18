// ui.js

import { state } from "../utils/state.js";
import { Table } from "./table.js";
import { UIEngine } from "./ui.engine.js";
import { UIRenderer } from "./ui.renderer.js";

export const UI = {

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

    if (!imb || Object.keys(imb).length === 0) {
      UIEngine.setText("target-column-display", "Detecting...");
    } else {
      UIEngine.setText("target-column-display", imb.target_column || "Not Set");
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

    // 🔴 IMPORTANT: KEEP THIS (behavior preserved)
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
          <h3 class="h5 mb-0 d-flex align-items-center">
            <i data-lucide="${config.headerIcon}" class="me-2"></i>
            Data Leakage Analysis
          </h3>
          <span class="badge ${config.badgeClass}">
            ${leakage.leakage_risk} RISK
          </span>
        </div>

        <div class="leakage-details">
          ${this._renderLeakageGroup("PERFECT PREDICTORS", perfect, "zap-off", "bg-danger", "text-danger")}
          ${this._renderLeakageGroup("HIGH CORRELATION (>0.90)", highCorr, config.itemIcon, "bg-warning text-dark", config.textClass)}
          ${this._renderLeakageGroup("DUPLICATE COLUMNS", duplicates, "copy", "bg-secondary", "text-secondary")}
        </div>

        <div class="small mt-3">${config.msg}</div>
      </div>`;

    if (window.lucide) lucide.createIcons();
  },

  _getLeakageConfig(isHighRisk) {
    return isHighRisk
      ? {
          class: "border-danger",
          bg: "#fff5f5",
          accent: "var(--danger)",
          headerIcon: "alert-octagon",
          itemIcon: "shield-alert",
          textClass: "text-danger",
          badgeClass: "bg-danger",
          msg: "<strong>Critical:</strong> Perfect predictors found."
        }
      : {
          class: "border-warning",
          bg: "#fffdf5",
          accent: "var(--warning)",
          headerIcon: "search",
          itemIcon: "eye",
          textClass: "text-warning-dark",
          badgeClass: "bg-warning text-dark",
          msg: "<strong>Warning:</strong> High correlation detected."
        };
  },

  _renderLeakageGroup(title, items, icon, badgeCls, textCls) {
    if (!items.length) return '';
    return `
      <div class="mb-3">
        <span class="${textCls} small fw-bold">
          <i data-lucide="${icon}"></i> ${title}:
        </span>
        <div class="mt-2">
          ${items.map(item => `<span class="badge ${badgeCls} m-1">${item}</span>`).join("")}
        </div>
      </div>`;
  },

  _generateCleanLeakageHTML() {
    return `
      <div class="alert alert-success">
        ✅ Data Integrity Verified
      </div>`;
  }
};
