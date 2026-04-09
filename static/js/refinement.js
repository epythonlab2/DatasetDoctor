import { API } from './ui/api.js';

export const DataDeduplicator = {
    /**
     * Step 1: Prepare the Modal
     */
    prepare(id) {
        if (!id) return;
        const btn = document.getElementById('btn-dedupe');
        if (btn) {
            btn.setAttribute('data-dataset-id', id);
            btn.disabled = false;
            btn.classList.remove('btn-success');
            btn.classList.add('btn-primary');
            btn.innerHTML = `Run Deduplication`;
        }
        
        this._updateStatusUI("Ready for Surgery", "text-muted", "#94a3b8");
    },

    /**
     * Step 2: Run the Process
     */
    async runDeduplicate() {
        const btn = document.getElementById('btn-dedupe');
        if (!btn) return;

        const datasetId = btn.getAttribute('data-dataset-id');

        if (!datasetId || datasetId === "undefined") {
            this._handleError("Dataset ID lost. Please reopen the modal.");
            return;
        }

        this._toggleLoading(btn, true);
        this._updateStatusUI("Deduplicating...", "text-warning", "#f59e0b");

        try {
            const response = await API.cleanDataset(datasetId);
            console.log("Surgery Initialized:", response);
            this.pollStatus(datasetId);
        } catch (error) {
            console.error("Trigger Failed:", error);
            this._handleError(error.message || "Failed to start process");
        }
    },

    /**
     * Step 3: Polling Loop
     */
    pollStatus(id) {
        const pollInterval = setInterval(async () => {
            try {
                const meta = await API.fetchMeta(id);

                if (meta.status === 'ready') {
                    clearInterval(pollInterval);
                    this._onComplete(meta);
                } else if (meta.status === 'failed') {
                    clearInterval(pollInterval);
                    this._handleError(meta.error || "Surgery failed in the engine.");
                }
            } catch (e) {
                console.warn("Polling attempt failed, retrying...", e);
                // We don't clear interval here so it tries again in 2s
            }
        }, 2000);
    },

    _onComplete(meta) {
        const btn = document.getElementById('btn-dedupe');
        this._toggleLoading(btn, false);

        if (btn) {
            btn.classList.replace('btn-primary', 'btn-success');
            btn.innerHTML = `<i data-lucide="check-circle" class="me-2" style="width:16px;"></i> Optimized`;
        }

        this._updateStatusUI("Optimized", "text-success", "#10b981");
        this._refreshDashboardStats(meta);

        if (window.lucide) window.lucide.createIcons();
    },

    // Inside refinement.js
	_updateStatusUI(text, textClass, pingColor) {
	    // Target the "Ready" text and the dot/ping in your fragment
	    const statusText = document.querySelector('.live-indicator .small');
	    const dot = document.querySelector('.live-indicator .dot');
	    const ping = document.querySelector('.live-indicator .ping');
	    
	    if (statusText) {
		statusText.innerText = text;
		// Optionally swap classes if you want it to turn red/green
	    }
	    if (dot) dot.style.backgroundColor = pingColor;
	    if (ping) ping.style.borderColor = pingColor; 
	},
    _toggleLoading(btn, isLoading) {
        if (!btn) return;
        btn.disabled = isLoading;
        btn.innerHTML = isLoading 
            ? `<span class="spinner-border spinner-border-sm me-2"></span> Processing...` 
            : `Run Deduplication`;
    },

    _refreshDashboardStats(meta) {
        const rowCount = document.getElementById('stat-rows');
        const qualityScore = document.getElementById('stat-quality');

        if (meta && meta.summary) {
            if (rowCount) rowCount.innerText = meta.summary.rows.toLocaleString();
            if (qualityScore) qualityScore.innerText = `${meta.summary.quality_score}%`;
        }
    },

    _handleError(msg) {
        const btn = document.getElementById('btn-dedupe');
        this._toggleLoading(btn, false);
        this._updateStatusUI("Error", "text-danger", "#ef4444");
        alert(`Deduplication Error: ${msg}`);
    }
};
