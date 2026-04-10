/**
 * Actions Module (Production-Grade)
 * --------------------------------
 * Secure, state-driven, and resilient implementation for dataset operations.
 */

import { API } from "./api.js";
import { state } from "./state.js";
import {isValidId, sanitizeColumn, withTimeout} from "./utils.js";


/* ------------------ Actions ------------------ */

export const Actions = {
  _pollInterval: null,
  _currentAction: null,

  /* ---------- Session Management ---------- */

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

  /* ---------- Cleaning Engine ---------- */

  Dedupe: {
    _selectedDropCols: new Set(),

    prepare(datasetId, columns = []) {
      if (!isValidId(datasetId)) return;

      this._resetButtons(datasetId);
      this._populateColumnSelector(columns);
      this._selectedDropCols.clear();
      this._renderColumnTags();
    },

    /* ---------- Logic Execution ---------- */

    async run() {
      const datasetId = state.datasetId;
      if (!isValidId(datasetId)) return;

      this._setAction("dedupe");
      this._setLoading("btn-dedupe", true, "Cleaning...");
      this._updateStatus("Deduplicating...", "#f59e0b");

      try {
        await withTimeout(API.cleanDataset(datasetId, { action: "remove_duplicates" }));
        Actions._startPolling(datasetId, this._onComplete.bind(this));
      } catch (err) {
        this._handleError(err);
      }
    },

    async runDropColumns() {
      const datasetId = state.datasetId;
      const cols = Array.from(this._selectedDropCols).map(sanitizeColumn);

      if (!cols.length) return alert("Select at least one column.");
      if (!confirm(`Permanently drop columns: ${cols.join(", ")}?`)) return;

      this._setAction("drop");
      this._setLoading("btn-drop-cols", true, "Dropping...");
      this._updateStatus("Dropping columns...", "#f59e0b");

      try {
        await withTimeout(API.cleanDataset(datasetId, { 
          action: "drop_columns", 
          columns: cols 
        }));
        Actions._startPolling(datasetId, this._onComplete.bind(this));
      } catch (err) {
        this._handleError(err);
      }
    },

    /* ---------- Column Tag Management ---------- */

    addColumnTag(col) {
      const clean = sanitizeColumn(col);
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
        const span = document.createElement("span");
        span.className = "text-muted small ps-1";
        span.textContent = "No columns selected...";
        container.appendChild(span);
        return;
      }

      this._selectedDropCols.forEach((col) => {
        const badge = document.createElement("span");
        badge.className = "badge d-flex-custom align-items-center gap-2 px-3 py-2";
        badge.style.cssText = "background: #f1f5f9; color: #475569; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 0.75rem;";

        const text = document.createTextNode(col);
        const icon = document.createElement("i");
        icon.setAttribute("data-lucide", "x");
        icon.className = "cursor-pointer";
        icon.style.cssText = "width:14px; height:14px; color: #ef4444;";
        icon.addEventListener("click", () => this.removeColumnTag(col));

        badge.appendChild(text);
        badge.appendChild(icon);
        container.appendChild(badge);
      });

      if (window.lucide) window.lucide.createIcons();
    },

    /* ---------- State Handlers ---------- */

    _onComplete(meta) {
      this._resetLoading();

      if (Actions._currentAction === "dedupe") this._handleDedupeSuccess(meta);
      if (Actions._currentAction === "drop") this._handleDropSuccess();

      this._updateStatus("Process Complete", "#10b981");
      this._updateDashboard(meta);
      
      // Update local state without losing success button visual
      this._populateColumnSelector(meta?.columns || []);
    },

    _handleDedupeSuccess(meta) {
      const btn = document.getElementById("btn-dedupe");
      if (!btn) return;

      const removed = meta?.cleaning?.remove_duplicates?.duplicates_removed ?? 0;
      btn.textContent = "";

      const icon = document.createElement("i");
      icon.setAttribute("data-lucide", removed > 0 ? "check-circle" : "sparkles");
      icon.className = "me-2";

      const text = document.createTextNode(removed > 0 ? "Optimized" : "Already Optimized");

      btn.append(icon, text);
      btn.className = "btn btn-success text-white border-0 d-flex align-items-center";
      //btn.style.backgroundColor = "#10b981";
      btn.style.color = "#10b981";

      if (window.lucide) window.lucide.createIcons();
    },

    _handleDropSuccess() {
	  const btn = document.getElementById("btn-drop-cols");
	  if (!btn) return;

	  // 1. Clear the internal state and the UI tags immediately
	  this._selectedDropCols.clear();
	  this._renderColumnTags();

	  // 2. Update Button UI to Success State
	  btn.textContent = "";
	  const icon = document.createElement("i");
	  icon.setAttribute("data-lucide", "trash-2");
	  icon.className = "me-2";
	  const text = document.createTextNode("Columns Dropped");

	  btn.append(icon, text);
	  // Using classList is cleaner for styling transitions
	  btn.style.color = "#f2f2f2"; 
	  btn.style.borderColor = "#10b981";

	  if (window.lucide) window.lucide.createIcons();

	  // 3. Revert button to idle state after 3 seconds
	  setTimeout(() => {
	    btn.textContent = "Drop Selected Columns";
	    btn.style.color = "";
	    btn.style.borderColor = "";
	  }, 3000);
	},

    /* ---------- UI Helpers ---------- */

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
      this._setLoading("btn-dedupe", false);
      this._setLoading("btn-drop-cols", false);
    },

    _updateStatus(text, color) {
      const el = document.querySelector(".live-indicator .small");
      const dot = document.querySelector(".live-indicator .dot");
      if (el) el.textContent = text;
      if (dot) dot.style.backgroundColor = color;
    },

    _updateDashboard(meta) {
      if (!meta?.summary) return;
      const rows = document.getElementById("rows");
      const score = document.getElementById("quality-score");
      if (rows) rows.textContent = meta.summary.rows?.toLocaleString() ?? "-";
      if (score) score.textContent = `${meta.summary.quality_score ?? 0}%`;
    },

    _handleError(err) {
      console.error("Operation failed:", err);
      this._resetLoading();
      this._updateStatus("Error", "#ef4444");
      alert(`Engine Error: ${err.message}`);
    },

    _resetButtons(datasetId) {
      const btn = document.getElementById("btn-dedupe");
      if (btn) {
        btn.dataset.datasetId = datasetId;
        btn.disabled = false;
        btn.className = "btn btn-primary d-flex align-items-center";
        btn.textContent = "Run Deduplication";
        btn.style.backgroundColor = "";
      }
    },

    _populateColumnSelector(columns) {
      const selector = document.getElementById("col-drop-selector");
      if (!selector) return;

      selector.textContent = "";
      const placeholder = document.createElement("option");
      placeholder.textContent = "Choose columns...";
      placeholder.disabled = true;
      placeholder.selected = true;
      selector.appendChild(placeholder);

      columns.forEach((col) => {
        const option = document.createElement("option");
        const val = col.name || col;
        option.value = val;
        option.textContent = val;
        selector.appendChild(option);
      });
    },
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
          throw new Error(meta?.error || "Processing failed");
        }
      } catch (err) {
        if (++retries >= 10) {
          this._clearPolling();
          this.Dedupe._handleError(new Error("Connection lost. Try refreshing."));
        }
      }
    }, 2000);
  },

  _clearPolling() {
    if (this._pollInterval) {
      clearInterval(this._pollInterval);
      this._pollInterval = null;
    }
  },
};
