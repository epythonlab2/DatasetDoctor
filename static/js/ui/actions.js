/**
 * Actions Module (Production-Grade)
 * --------------------------------
 * Cleaned, Unified, and Fixed Toggle Logic.
 */

import { API } from "./api.js";
import { state } from "./state.js";
import { isValidId, formatColumnForDisplay, withTimeout } from "./utils.js";

export const Actions = {
  _pollInterval: null,
  _currentAction: null,

  /* ---------- Session & Export ---------- */

  async reset() {
    if (!confirm("This will delete all analysis. Continue?")) return;
    try {
      this._clearPolling();
      state.datasetId = null;
      await withTimeout(API.reset());
      window.location.replace("/");
    } catch (err) {
      console.error("Reset failed:", err);
      window.location.href = "/";
    }
  },

  export() {
    const id = state.datasetId;
    if (!id || !isValidId(id)) return alert("Invalid dataset.");
    window.location.href = API.getUrl(`/export/${encodeURIComponent(id)}`);
  },

  /* ---------- Smart Imputation Core ---------- */

  toggleImputeTip(event) {
    event.stopPropagation(); 
    const popup = document.getElementById('impute-tip-popup');
    if (!popup) return;

    const isShowing = popup.style.display === 'block';
    popup.style.display = isShowing ? 'none' : 'block';

    if (!isShowing) {
      const closeHandler = () => {
        popup.style.display = 'none';
        document.removeEventListener('click', closeHandler);
      };
      setTimeout(() => document.addEventListener('click', closeHandler), 10);
    }
  },

  async runImpute() {
    const col = document.getElementById("impute-column")?.value;
    const method = document.getElementById("impute-method")?.value;

    if (!col || col.includes("Select")) return alert("Please select a target column.");

    this.Dedupe._setAction("impute");
    this.Dedupe._setLoading("btn-apply-impute", true, "Fixing...");
    this.Dedupe._updateStatus("Imputing values...", "#f59e0b");

    try {
      await API.cleanDataset(state.datasetId, { 
        action: "smart_impute", 
        columns: [col], 
        method: method 
      });
      
      this._startPolling(state.datasetId, (meta) => {
        this.Dedupe._onComplete(meta);
        const popup = document.getElementById('impute-tip-popup');
        if (popup) popup.style.display = 'none';
      });
    } catch (err) { 
      this.Dedupe._handleError(err); 
    }
  },
  
  /* ---------- Schema Casting Core ---------- */

  toggleCastTip(event) {
    if (event) event.stopPropagation();
    const popup = document.getElementById('cast-tip-popup');
    if (!popup) return;
    const isHidden = popup.style.display === 'none' || popup.style.display === '';
    popup.style.display = isHidden ? 'block' : 'none';
  },

  async runCast() {
    const col = document.getElementById("cast-column")?.value;
    const type = document.getElementById("cast-type")?.value;

    if (!col || col.includes("Select")) return alert("Please select a column to convert.");

    this.Dedupe._setAction("cast");
    this.Dedupe._setLoading("btn-apply-cast", true, "Converting...");
    this.Dedupe._updateStatus("Casting schema...", "#3b82f6");

    try {
      await API.cleanDataset(state.datasetId, { 
          action: "cast_schema", 
          columns: [col], 
          method: type 
      });

      this._startPolling(state.datasetId, (meta) => {
          this.Dedupe._onComplete(meta);
          const tip = document.getElementById('cast-tip-popup');
          if (tip) tip.style.display = 'none';
      });
    } catch (err) {
      this.Dedupe._handleError(err);
    }
  },

  /* ---------- Cleaning Engine (Nested Helpers) ---------- */

  Dedupe: {
    _selectedDropCols: new Set(),

    prepare(datasetId, columns = []) {
      if (!isValidId(datasetId)) return;
      this._resetButtons(datasetId);
      this._populateColumnSelector(columns);
      this._selectedDropCols.clear();
      this._renderColumnTags();
    },

    async run() {
      const datasetId = state.datasetId;
      if (!isValidId(datasetId)) return;
      this._setAction("dedupe");
      this._setLoading("btn-dedupe", true, "Cleaning...");
      this._updateStatus("Deduplicating...", "#f59e0b");
      try {
        await withTimeout(API.cleanDataset(datasetId, { action: "remove_duplicates" }));
        Actions._startPolling(datasetId, this._onComplete.bind(this));
      } catch (err) { this._handleError(err); }
    },

    async runDropColumns() {
      const datasetId = state.datasetId;
      const cols = Array.from(this._selectedDropCols).map(formatColumnForDisplay);
      if (!cols.length) return alert("Select at least one column.");
      if (!confirm(`Permanently drop columns: ${cols.join(", ")}?`)) return;

      this._setAction("drop");
      this._setLoading("btn-drop-cols", true, "Dropping...");
      this._updateStatus("Dropping columns...", "#f59e0b");

      try {
        await withTimeout(API.cleanDataset(datasetId, { action: "drop_columns", columns: cols }));
        Actions._startPolling(datasetId, this._onComplete.bind(this));
      } catch (err) { this._handleError(err); }
    },

    /* --- UI Refresh Handlers --- */

    _onComplete(meta) {
      this._resetLoading();
      if (Actions._currentAction === "dedupe") this._handleDedupeSuccess(meta);
      if (Actions._currentAction === "drop") this._handleDropSuccess();
      if (Actions._currentAction === "impute") this._handleImputeSuccess();
      if (Actions._currentAction === "cast") this._handleCastSuccess();

      this._updateStatus("Process Complete", "#10b981");
      this._updateDashboard(meta);
      this._populateColumnSelector(meta?.columns || []);
    },

    _handleImputeSuccess() {
      const btn = document.getElementById("btn-apply-impute");
      if (!btn) return;
      btn.innerHTML = `<i data-lucide="check" class="me-2"></i> Fixed!`;
      btn.style.color = "#10b981";
      btn.style.borderColor = "#10b981";
      if (window.lucide) window.lucide.createIcons();
      setTimeout(() => {
        btn.innerHTML = "Apply Imputation";
        btn.style.color = ""; btn.style.borderColor = "";
      }, 3000);
    },

    _handleCastSuccess() {
      const btn = document.getElementById("btn-apply-cast");
      if (!btn) return;
      btn.innerHTML = `<i data-lucide="check" class="me-2"></i> Type Updated`;
      btn.style.color = "#10b981";
      btn.style.borderColor = "#10b981";
      if (window.lucide) window.lucide.createIcons();
      setTimeout(() => {
        btn.innerHTML = "Convert Schema";
        btn.style.color = ""; btn.style.borderColor = "";
      }, 3000);
    },

    _handleDedupeSuccess(meta) {
      const btn = document.getElementById("btn-dedupe");
      if (!btn) return;
      const removed = meta?.cleaning?.remove_duplicates?.duplicates_removed ?? 0;
      btn.innerHTML = `<i data-lucide="${removed > 0 ? 'check-circle' : 'sparkles'}" class="me-2"></i> ${removed > 0 ? 'Optimized' : 'Already Optimized'}`;
      btn.className = "btn btn-success text-white border-0 d-flex align-items-center";
      btn.style.color = "#10b981";
      if (window.lucide) window.lucide.createIcons();
    },

    _handleDropSuccess() {
      const btn = document.getElementById("btn-drop-cols");
      if (!btn) return;
      this._selectedDropCols.clear();
      this._renderColumnTags();
      btn.innerHTML = `<i data-lucide="trash-2" class="me-2"></i> Columns Dropped`;
      btn.style.color = "#f2f2f2"; btn.style.borderColor = "#10b981";
      if (window.lucide) window.lucide.createIcons();
      setTimeout(() => {
        btn.textContent = "Drop Selected Columns";
        btn.style.color = ""; btn.style.borderColor = "";
      }, 3000);
    },

    /* --- Selector & Tag Management --- */

    _populateColumnSelector(columns) {
      const dropSelector = document.getElementById("col-drop-selector");
      const imputeSelector = document.getElementById("impute-column");
      const castSelector = document.getElementById("cast-column");

      if (dropSelector) {
        dropSelector.innerHTML = '<option selected disabled>Choose columns...</option>';
        columns.forEach(col => {
          const opt = document.createElement("option");
          opt.value = col.name || col;
          opt.textContent = col.name || col;
          dropSelector.appendChild(opt);
        });
      }

      if (imputeSelector) {
        imputeSelector.innerHTML = '<option selected disabled>Select a column...</option>';
        const missingCols = columns.filter(col => (col.missingPercent ?? col.null_count ?? 0) > 0);
        if (!missingCols.length) {
          imputeSelector.innerHTML = '<option disabled>No missing data found! 🎉</option>';
        } else {
          missingCols.forEach(col => {
            const opt = document.createElement("option");
            opt.value = col.name;
            opt.textContent = `${col.name} (${col.missingPercent ?? col.null_count}% missing)`;
            imputeSelector.appendChild(opt);
          });
        }
      }

      if (castSelector) {
        castSelector.innerHTML = '<option selected disabled>Select column...</option>';
        // Show all columns, but beginners usually need to fix 'Object' (String) types
        columns.forEach(col => {
            const opt = document.createElement("option");
            opt.value = col.name;
            const typeLabel = col.type === 'object' ? 'Text' : col.type;
            opt.textContent = `${col.name} (${typeLabel})`;
            castSelector.appendChild(opt);
        });
      }
    },

    addColumnTag(col) {
      const clean = formatColumnForDisplay(col);
      if (!clean || this._selectedDropCols.has(clean)) return;
      this._selectedDropCols.add(clean);
      this._renderColumnTags();
    },

    removeColumnTag(col) {
      this._selectedDropCols.delete(col);
      this._renderColumnTags();
    },

    _renderColumnTags() {
      const container = document.getElementById("drop-tags-container");
      if (!container) return;
      container.textContent = "";
      if (!this._selectedDropCols.size) {
        container.innerHTML = `<span class="text-muted small ps-1">No columns selected...</span>`;
        return;
      }
      this._selectedDropCols.forEach((col) => {
        const badge = document.createElement("span");
        badge.className = "badge d-flex align-items-center gap-2 px-3 py-2";
        badge.style.cssText = "background: #f1f5f9; color: #475569; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 0.75rem;";
        badge.innerHTML = `${col} <i data-lucide="x" class="cursor-pointer" style="width:14px; height:14px; color: #ef4444;" onclick="Actions.Dedupe.removeColumnTag('${col}')"></i>`;
        container.appendChild(badge);
      });
      if (window.lucide) window.lucide.createIcons();
    },

    /* --- Shared UI Helpers --- */
    _setAction(action) { Actions._currentAction = action; },
    _setLoading(btnId, isLoading, text) {
      const btn = document.getElementById(btnId);
      if (!btn) return;
      btn.disabled = isLoading;
      if (isLoading) {
        btn.dataset.original = btn.innerHTML;
        btn.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span> ${text}`;
      } else {
        btn.innerHTML = btn.dataset.original || btn.innerHTML;
      }
    },
    _resetLoading() {
      ["btn-dedupe", "btn-drop-cols", "btn-apply-impute", "btn-apply-cast"].forEach(id => this._setLoading(id, false));
    },
    _updateStatus(text, color) {
      const el = document.querySelector(".live-indicator .small");
      const dot = document.querySelector(".live-indicator .dot");
      if (el) el.textContent = text;
      if (dot) dot.style.backgroundColor = color;
    },
    _updateDashboard(meta) {
      const rows = document.getElementById("rows");
      const score = document.getElementById("quality-score");
      if (rows) rows.textContent = meta?.summary?.rows?.toLocaleString() ?? "-";
      if (score) score.textContent = `${meta?.summary?.quality_score ?? 0}%`;
    },
    _handleError(err) {
      this._resetLoading();
      this._updateStatus("Error", "#ef4444");
      alert(`Engine Error: ${err.message}`);
    },
    _resetButtons(datasetId) {
      const btn = document.getElementById("btn-dedupe");
      if (btn) {
        btn.disabled = false;
        btn.className = "btn btn-primary d-flex align-items-center";
        btn.textContent = "Run Deduplication";
      }
    }
  },

  /* ---------- Polling Engine ---------- */

  _startPolling(datasetId, onComplete) {
    this._clearPolling();
    let retries = 0;
    this._pollInterval = setInterval(async () => {
      try {
        const meta = await withTimeout(API.fetchMeta(datasetId), 5000);
        if (meta?.status === "ready") {
          this._clearPolling();
          onComplete(meta);
        } else if (meta?.status === "failed") {
          this._clearPolling();
          this.Dedupe._handleError(new Error(meta?.error || "Processing failed"));
        }
      } catch (err) {
        if (++retries >= 10) {
          this._clearPolling();
          this.Dedupe._handleError(new Error("Connection lost."));
        }
      }
    }, 2000);
  },

  _clearPolling() {
    if (this._pollInterval) {
      clearInterval(this._pollInterval);
      this._pollInterval = null;
    }
  }
};
