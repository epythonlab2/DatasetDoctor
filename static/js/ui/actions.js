/**
 * Actions Module (Production-Grade Pipeline)
 * --------------------------------
 * Updated with Progress Bar Logic
 */

import { API } from "../api.js";
import { state } from "../utils/state.js";
import { isValidId, formatColumnForDisplay, withTimeout } from "../utils/utils.js";

export const Actions = {
  _pollInterval: null,
  _currentAction: null,
  _pipeline: [], // Local queue for CleaningStep objects

  /* ---------- Pipeline Logic ---------- */

  _stageStep(action, columns = null, method = "auto") {
    this._pipeline.push({ action, columns, method });
    this._updateBatchUI();
  },

  _updateBatchUI() {
    const bar = document.getElementById('batch-bar');
    const countEl = document.getElementById('batch-count');
    if (!bar || !countEl) return;

    if (this._pipeline.length > 0) {
      countEl.textContent = this._pipeline.length;
      bar.classList.add('visible');
    } else {
      bar.classList.remove('visible');
      bar.classList.remove('processing'); // Reset state if empty
    }
  },

  /**
   * Helper: Updates the visual progress bar
   */
  _updateProgressBar(percent, titleText = null) {
    const fill = document.getElementById('progress-fill');
    const text = document.getElementById('progress-percent');
    const title = document.getElementById('batch-status-title');
    
    if (fill) fill.style.width = `${percent}%`;
    if (text) text.textContent = `${Math.floor(percent)}%`;
    if (title && titleText) title.textContent = titleText;
  },

  clearQueue() {
    this._pipeline = [];
    this.Dedupe._selectedDropCols.clear();
    this.Dedupe._renderColumnTags();
    this._updateBatchUI();
    this.Dedupe._updateStatus("Queue Cleared", "#64748b");
    
    // Reset progress UI
    const bar = document.getElementById('batch-bar');
    if (bar) bar.classList.remove('processing');
    this._updateProgressBar(0, "Cleaning Pipeline Queued");
  },

  /**
   * Sends the full pipeline to the backend with progress tracking
   */
  /**
   * Sends the full pipeline to the backend and runs the visual progress loop.
   */
  async executePipeline() {
    const datasetId = state.datasetId;
    if (!datasetId || this._pipeline.length === 0) return;

    // 1. Map elements from your sample logic
    const bar = document.getElementById('batch-bar');
    const actions = document.getElementById('batch-actions');
    const progressContainer = document.getElementById('batch-progress-container');
    const fill = document.getElementById('progress-fill');
    const title = document.getElementById('batch-status-title');
    const subtitle = document.getElementById('batch-status-sub');
    const btn = document.getElementById("btn-run-batch");

    // 2. Initial UI State change
    if (bar) bar.classList.add('processing');
    if (actions) actions.style.display = 'none';
    if (progressContainer) progressContainer.style.display = 'block';
    
    title.innerText = "Processing Data...";
    this.Dedupe._setLoading("btn-run-batch", true, "Running...");

    try {
      // 3. The API Call (runs in background)
      const apiPromise = API.cleanDataset(datasetId, { pipeline: this._pipeline });

      // 4. Your custom progress loop logic
      for (let i = 0; i <= 100; i += 5) {
        if (fill) fill.style.width = i + '%';
        if (subtitle) subtitle.innerText = `Synchronizing block ${Math.ceil(i / 20)} of 5...`;
        
        // Update the percentage text if you have that element
        const percentText = document.getElementById('progress-percent');
        if (percentText) percentText.innerText = i + '%';

        await new Promise(r => setTimeout(r, 60));
      }

      // Wait for API to definitely finish if it's slower than the animation
      await apiPromise;

      // 5. Completion State
      title.innerHTML = '<span style="color: #10b981">Analysis Complete</span>';
      subtitle.innerText = `${this._pipeline.length} operations synchronized successfully.`;

      // 6. Final Polling & Cleanup Delay
      this._startPolling(datasetId, (meta) => {
        setTimeout(() => {
          this.clearQueue(); // This handles clearing the pipeline and resetting UI
          
          // Reset UI to original state
          if (actions) actions.style.display = 'flex';
          if (progressContainer) progressContainer.style.display = 'none';
          if (bar) bar.classList.remove('processing');
          
          title.innerText = "Cleaning Pipeline Queued";
          subtitle.innerText = "Batch processing optimized for high-volume datasets.";
          
          this.Dedupe._onComplete(meta);
          this.Dedupe._setLoading("btn-run-batch", false);
        }, 2500);
      });

    } catch (err) {
      this.Dedupe._handleError(err);
      // Reset UI on error so user isn't stuck
      if (actions) actions.style.display = 'flex';
      if (progressContainer) progressContainer.style.display = 'none';
      if (bar) bar.classList.remove('processing');
      this.Dedupe._setLoading("btn-run-batch", false);
    }
  },

  /* ---------- Session & Export ---------- */

  async reset() {
    if (!confirm("This will delete all analysis. Continue?")) return;
    try {
      this._clearPolling();
      const id = state.datasetId || window.location.pathname.split('/').filter(Boolean).pop();
      if (id) {
        await withTimeout(API.reset(id));
        localStorage.removeItem("dataset_id");
      }
      state.datasetId = null;
      window.location.replace("/uploader");
    } catch (err) {
      console.error("Reset failed:", err);
      window.location.href = "/uploader";
    }
  },

  async export() {
    const id = state.datasetId;
    if (!id) return;
    try {
      await API.verifyExport(id);
      const meta = await API.fetchMeta(id);
      if (meta.status !== "ready") throw new Error("Dataset is still processing.");
      window.location.href = API.getUrl(`/export/${encodeURIComponent(id)}`);
    } catch (err) {
      alert(`Export Warning: ${err.detail || err.message || "An unexpected error occurred"}`);
    }
  },

  /* ---------- Smart Imputation Core ---------- */

  toggleImputeTip(event) {
    event.stopPropagation();
    const popup = document.getElementById('impute-tip-popup');
    if (!popup) return;
    popup.style.display = popup.style.display === 'block' ? 'none' : 'block';
  },

  async runImpute() {
    const col = document.getElementById("impute-column")?.value;
    const method = document.getElementById("impute-method")?.value;
    if (!col || col.includes("Select")) return alert("Please select a target column.");

    this._stageStep("smart_impute", [col], method);
    this.Dedupe._handleImputeSuccess("Staged!");
    const popup = document.getElementById('impute-tip-popup');
    if (popup) popup.style.display = 'none';
  },

  /* ---------- Schema Casting Core ---------- */
  
  toggleCastTip(event) {
    event.stopPropagation(); 
    const popup = document.getElementById('cast-tip-popup');
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

  async runCast() {
    const col = document.getElementById("cast-column")?.value;
    const type = document.getElementById("cast-type")?.value;
    if (!col || col.includes("Select")) return alert("Please select a column to convert.");

    this._stageStep("cast_schema", [col], type);
    this.Dedupe._handleCastSuccess("Staged!");
    const tip = document.getElementById('cast-tip-popup');
    if (tip) tip.style.display = 'none';
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
      Actions._updateBatchUI();
    },

    async run() {
      Actions._stageStep("remove_duplicates");
      this._handleDedupeSuccess(null, true);
    },

    async runDropColumns() {
      const cols = Array.from(this._selectedDropCols);
      if (!cols.length) return alert("Select at least one column.");
      Actions._stageStep("drop_columns", cols);
      this._handleDropSuccess(true);
    },

    _onComplete(meta) {
      this._resetLoading();
      this._updateStatus("Process Complete", "#10b981");
      this._updateDashboard(meta);
      this._populateColumnSelector(meta?.columns || []);
      
      const bar = document.getElementById('batch-bar');
      if (bar) bar.classList.remove('processing');

      if (meta?.cleaning?.remove_duplicates) {
        this._handleDedupeSuccess(meta, false);
      }
    },

    _handleImputeSuccess(msg = "Fixed!") {
      const btn = document.getElementById("btn-apply-impute");
      if (!btn) return;
      btn.innerHTML = `<i data-lucide="plus-circle" class="me-2"></i> ${msg}`;
      btn.style.color = "#10b981";
      if (window.lucide) window.lucide.createIcons();
      setTimeout(() => { btn.innerHTML = "Queue Imputation"; btn.style.color = ""; }, 2000);
    },

    _handleCastSuccess(msg = "Staged") {
      const btn = document.getElementById("btn-apply-cast");
      if (!btn) return;
      btn.innerHTML = `<i data-lucide="plus-circle" class="me-2"></i> ${msg}`;
      btn.style.color = "#10b981";
      if (window.lucide) window.lucide.createIcons();
      setTimeout(() => { btn.innerHTML = "Queue Schema"; btn.style.color = ""; }, 2000);
    },

    _handleDedupeSuccess(meta, isStaged = false) {
      const btn = document.getElementById("btn-dedupe");
      if (!btn) return;
      if (isStaged) {
        btn.innerHTML = `<i data-lucide="plus-circle" class="me-2"></i> Dedupe Staged`;
        btn.style.color = "#10b981";
      } else {
        const removed = meta?.cleaning?.remove_duplicates?.duplicates_removed ?? 0;
        btn.innerHTML = `<i data-lucide="check-circle" class="me-2"></i> ${removed > 0 ? 'Optimized' : 'Clean'}`;
        btn.className = "btn btn-success text-white border-0 d-flex align-items-center";
      }
      if (window.lucide) window.lucide.createIcons();
    },

    _handleDropSuccess(isStaged = false) {
      const btn = document.getElementById("btn-drop-cols");
      if (!btn) return;
      this._selectedDropCols.clear();
      this._renderColumnTags();
      btn.innerHTML = `<i data-lucide="trash-2" class="me-2"></i> ${isStaged ? "Drop Staged" : "Dropped"}`;
      if (window.lucide) window.lucide.createIcons();
      setTimeout(() => { btn.textContent = "Add Columns to Queue"; }, 2000);
    },

    _populateColumnSelector(columns) {
      const selectors = {
        drop: document.getElementById("col-drop-selector"),
        impute: document.getElementById("impute-column"),
        cast: document.getElementById("cast-column")
      };

      if (selectors.drop) {
        selectors.drop.innerHTML = '<option selected disabled>Choose columns...</option>';
        columns.forEach(col => {
          const opt = new Option(col.name || col, col.name || col);
          selectors.drop.add(opt);
        });
      }

      if (selectors.impute) {
        const missing = columns.filter(c => (c.missingPercent || c.null_count || 0) > 0);
        selectors.impute.innerHTML = missing.length 
          ? '<option selected disabled>Select column...</option>' 
          : '<option disabled>No missing values! 🎉</option>';
        missing.forEach(c => selectors.impute.add(new Option(`${c.name} (${c.missingPercent}%)`, c.name)));
      }

      if (selectors.cast) {
        selectors.cast.innerHTML = '<option selected disabled>Select column...</option>';
        columns.forEach(c => selectors.cast.add(new Option(`${c.name} (${c.type})`, c.name)));
      }
    },

    addColumnTag(col) {
      const clean = formatColumnForDisplay(col);
      if (!clean || this._selectedDropCols.has(clean)) return;
      this._selectedDropCols.add(clean);
      this._renderColumnTags();
      Actions._updateBatchUI();
    },

    removeColumnTag(col) {
      this._selectedDropCols.delete(col);
      this._renderColumnTags();
      Actions._updateBatchUI();
    },

    _renderColumnTags() {
      const container = document.getElementById("drop-tags-container");
      if (!container) return;
      container.innerHTML = this._selectedDropCols.size === 0 ? '<span class="text-muted small ps-1">No selection...</span>' : "";
      this._selectedDropCols.forEach(col => {
        const badge = document.createElement("span");
        badge.className = "badge d-flex align-items-center gap-2 px-3 py-2";
        badge.style.cssText = "background: #f1f5f9; color: #475569; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 0.75rem;";
        badge.innerHTML = `${col} <i data-lucide="x" class="cursor-pointer" style="width:14px; height:14px; color: #ef4444;" onclick="Actions.Dedupe.removeColumnTag('${col}')"></i>`;
        container.appendChild(badge);
      });
      if (window.lucide) window.lucide.createIcons();
    },

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
      ["btn-dedupe", "btn-drop-cols", "btn-apply-impute", "btn-apply-cast", "btn-run-batch"].forEach(id => this._setLoading(id, false));
    },

    _updateStatus(text, color) {
      const el = document.querySelector(".live-indicator .small");
      const dot = document.querySelector(".live-indicator .dot");
      if (el) el.textContent = text;
      if (dot) dot.style.backgroundColor = color;
    },

    _updateDashboard(meta) {
      document.getElementById("rows") && (document.getElementById("rows").textContent = meta?.summary?.rows?.toLocaleString() ?? "-");
      document.getElementById("quality-score") && (document.getElementById("quality-score").textContent = `${meta?.summary?.quality_score ?? 0}%`);
    },

    _handleError(err) {
      this._resetLoading();
      this._updateStatus("Error", "#ef4444");
      console.error(err);
    },

    _resetButtons(datasetId) {
      const btn = document.getElementById("btn-dedupe");
      if (btn) {
        btn.disabled = false;
        btn.className = "btn btn-primary d-flex align-items-center";
        btn.textContent = "Add to Queue";
      }
    }
  },

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
          this.Dedupe._handleError(new Error(meta?.error || "Failed"));
        }
      } catch (err) {
        if (++retries >= 10) { this._clearPolling(); this.Dedupe._handleError(new Error("Timeout")); }
      }
    }, 2000);
  },

  _clearPolling() {
    if (this._pollInterval) { clearInterval(this._pollInterval); this._pollInterval = null; }
  }
};
