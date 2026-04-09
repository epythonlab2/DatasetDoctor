/**
 * Actions Module
 * Central hub for user-triggered operations, analysis management, and data cleaning.
 */
import { API } from "./api.js";
import { state } from "./state.js";

export const Actions = {
    
    /**
     * Resets the entire analysis session and redirects to home.
     */
    async reset() {
        if (!confirm("Are you sure? This will delete all current analysis and files.")) return;

        try {
            // Stop background dashboard polling
            if (window.analysisInterval) clearInterval(window.analysisInterval);
            state.datasetId = null; 

            await API.reset();
            window.location.replace("/"); 
        } catch (err) {
            console.error("Reset Failed:", err);
            window.location.href = "/"; // Fallback redirect
        }
    },

    /**
     * Triggers a browser download for the cleaned dataset.
     */
    export() {
        if (!state.datasetId) {
            alert("Analysis not ready for export.");
            return;
        }
        window.location.href = API.getUrl(`/export/${state.datasetId}`);
    },

    /**
     * Deduplication & Cleaning Logic
     */
    Dedupe: {
        _pollRetryCount: 0,
        _maxRetries: 10,

        /**
         * Prepares the UI within the Clean Modal
         */
        prepare(id) {
            if (!id) return;
            const btn = document.getElementById('btn-dedupe');
            if (btn) {
                btn.setAttribute('data-dataset-id', id);
                btn.disabled = false;
                btn.classList.replace('btn-success', 'btn-primary');
                btn.innerHTML = `Run Deduplication`;
            }
            this._updateStatusUI("Ready for Surgery", "#94a3b8");
        },

        /**
         * Triggers the backend cleaning pipeline
         */
        async run() {
            const btn = document.getElementById('btn-dedupe');
            const datasetId = btn?.getAttribute('data-dataset-id');

            if (!datasetId) {
                this._handleError("Dataset ID missing. Please reload.");
                return;
            }

            this._setBtnLoading(btn, true);
            this._updateStatusUI("Deduplicating...", "#f59e0b");

            try {
                await API.cleanDataset(datasetId);
                this._pollRetryCount = 0; // Reset retry counter
                this.pollStatus(datasetId);
            } catch (error) {
                this._handleError(error.message);
            }
        },

        /**
         * Polls the metadata until the status is 'ready' or 'failed'
         */
        pollStatus(id) {
            const pollInterval = setInterval(async () => {
                try {
                    const meta = await API.fetchMeta(id);
                    this._pollRetryCount = 0; // Success: reset error counter

                    if (meta.status === 'ready') {
                        clearInterval(pollInterval);
                        this._onComplete(meta);
                    } else if (meta.status === 'failed') {
                        clearInterval(pollInterval);
                        this._handleError(meta.error || "Processing failed.");
                    }
                } catch (e) {
                    this._pollRetryCount++;
                    console.warn(`Polling sync issues (${this._pollRetryCount}/${this._maxRetries})...`);

                    if (this._pollRetryCount >= this._maxRetries) {
                        clearInterval(pollInterval);
                        this._handleError("Sync lost. The engine is still working, but the UI cannot see it. Please refresh.");
                    }
                }
            }, 2000);
        },

        _onComplete(meta) {
            const btn = document.getElementById('btn-dedupe');
            this._setBtnLoading(btn, false);

            if (btn) {
                btn.classList.replace('btn-primary', 'btn-success');
                btn.innerHTML = `<i data-lucide="check-circle" class="me-2" style="color:#10b981",></i> Optimized`;
            }

            this._updateStatusUI("Optimized", "#10b981");
            this._updateDashboardStats(meta);
            if (window.lucide) window.lucide.createIcons();
        },

        _updateStatusUI(text, color) {
            const statusText = document.querySelector('.live-indicator .small');
            const dot = document.querySelector('.live-indicator .dot');
            const ping = document.querySelector('.live-indicator .ping');
            
            if (statusText) statusText.innerText = text;
            if (dot) dot.style.backgroundColor = color;
            if (ping) ping.style.borderColor = color; 
        },

        _setBtnLoading(btn, isLoading) {
            if (!btn) return;
            btn.disabled = isLoading;
            btn.innerHTML = isLoading 
                ? `<span class="spinner-border spinner-border-sm me-2"></span> Processing...` 
                : `Run Deduplication`;
        },

        _updateDashboardStats(meta) {
            // Update global dashboard items if they exist
            const elements = {
                'rows': document.getElementById('rows'),
                'quality-score': document.getElementById('quality-score')
            };

            if (meta.summary) {
                if (elements['rows']) elements['rows'].innerText = meta.summary.rows?.toLocaleString();
                if (elements['quality-score']) elements['quality-score'].innerText = `${meta.summary.quality_score}%`;
            }
        },

        _handleError(msg) {
            const btn = document.getElementById('btn-dedupe');
            this._setBtnLoading(btn, false);
            this._updateStatusUI("Error", "#ef4444");
            alert(`Deduplication Error: ${msg}`);
        }
    }
};
