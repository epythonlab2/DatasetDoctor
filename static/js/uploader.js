/**
 * DataFlow Dashboard Core
 * @module Uploader
 * @description Manages the multi-step dataset upload process, including file 
 * ingestion, progress tracking, preview rendering, and target selection.
 */

import { initNavigationGuard } from './utils/navigationGuard.js';

import { API } from './api.js';


// Initialize the navigation guard immediately at the top of the file
initNavigationGuard();


(() => {
    "use strict";

    /**
     * Application Constants
     * @type {Object}
     */
    const CONFIG = {
        DASHBOARD_REDIRECT_DELAY: 600
    };

    /**
     * Application State
     * @type {Object}
     */
    const state = {
        currentStep: 0,
        datasetId: null,
        _historyLocked: true // Prevents browser navigation until explicit actions occur
    };

    /**
     * UI Engine
     * Handles all DOM manipulations and visual updates.
     */
    const UI = {
        /** @type {Object<string, HTMLElement|NodeList>} */
        elements: {
            uploadCard: document.querySelector(".upload-card"),
            previewSection: document.getElementById("preview-section"),
            previewTable: document.getElementById("preview-table"),
            targetSelect: document.getElementById("target-select"),
            steps: document.querySelectorAll(".step"),
            overlay: document.getElementById("overlay-loader"),
            overlayText: document.getElementById("overlay-text"),
            progressFill: document.getElementById("progress-fill"),
            fileNameDisplay: document.getElementById("file-name-display"),
            progressPercent: document.getElementById("progress-percent"),
            statusText: document.getElementById("status-text"),
            continueBtn: document.getElementById("continue-btn"),
            loadingState: document.getElementById("loading-state")
        },

        /**
         * Updates the UI to display the selected filename.
         * @param {string} name 
         */
        setFileName(name) {
            if (this.elements.fileNameDisplay) {
                this.elements.fileNameDisplay.textContent = name || "";
            }
        },

        /**
         * Orchestrates visibility between upload and preview steps.
         * @param {number} index - The step index to show.
         * @param {boolean} [pushHistory=true] - Whether to update browser history.
         */
        showStep(index, pushHistory = false) {
            state.currentStep = index;
            const isUpload = index === 0;

            // Toggle visibility classes
            this.elements.uploadCard?.classList.toggle("hidden", !isUpload);
            this.elements.previewSection?.classList.toggle("hidden", isUpload);

            // Update stepper visual indicators
            this.elements.steps.forEach((step, i) => step.classList.toggle("active", i === index));

            if (pushHistory) {
                history.pushState({ step: index }, "", window.location.href);
            }
            else {
		// This keeps the URL the same without adding "back" steps
		history.replaceState({ step: index }, "", window.location.href);
	    }
        },

        /**
         * Updates progress bar and status text.
         * @param {number} percent - Completion percentage.
         * @param {string} text - Status message.
         */
        updateProgress(percent, text) {
            if (this.elements.progressFill) this.elements.progressFill.style.width = `${percent}%`;
            if (this.elements.progressPercent) this.elements.progressPercent.textContent = `${percent}%`;
            if (text && this.elements.statusText) this.elements.statusText.textContent = text;
        },

        /**
         * Toggles global processing overlay.
         * @param {boolean} show 
         * @param {string} [message="Processing..."] 
         */
        toggleOverlay(show, message = "Processing...") {
            if (!this.elements.overlay) return;
            if (this.elements.overlayText) this.elements.overlayText.textContent = message;
            this.elements.overlay.classList.toggle("hidden", !show);
        },

        /**
         * Generates and injects the preview table and populates the target dropdown.
         * @param {Object} previewData 
         */
        renderPreview(previewData) {
            const { columns = [], rows = [] } = previewData;
            const { previewTable, targetSelect } = this.elements;
            if (!previewTable || !targetSelect) return;

            // Clear previous content
            previewTable.innerHTML = "";

            // Build Header
            const thead = document.createElement("thead");
            const headerRow = document.createElement("tr");
            columns.forEach(col => {
                const th = document.createElement("th");
                th.textContent = col ?? "";
                headerRow.appendChild(th);
            });
            thead.appendChild(headerRow);
            previewTable.appendChild(thead);

            // Build Body
            const tbody = document.createElement("tbody");
            rows.forEach(row => {
                const tr = document.createElement("tr");
                columns.forEach(col => {
                    const td = document.createElement("td");
                    td.textContent = row[col] ?? "";
                    tr.appendChild(td);
                });
                tbody.appendChild(tr);
            });
            previewTable.appendChild(tbody);

            // Build Dropdown
            targetSelect.innerHTML = '<option value="" disabled selected>Select target column...</option>';
            columns.forEach(col => targetSelect.add(new Option(col, col)));
        },

        /**
         * Error communication interface.
         * @param {string} msg 
         */
        notifyError(msg) {
            console.error(`[DataFlow Error]: ${msg}`);
            alert(msg); // Placeholder for production toast system
        }
    };

    /**
     * Application Controller
     * Orchestrates events, API interaction, and state changes.
     */
    const App = {
        /**
         * Initializes application and sets default navigation state.
         */
        init() {
            this.bindEvents();
            history.replaceState({ step: 0 }, "", window.location.href);
            window.addEventListener("popstate", this.handleBackForward.bind(this));
            
            // Fade-in effect for the dashboard
            document.body.style.opacity = "1";
        },

        /**
         * Handles native browser navigation (back/forward buttons).
         * Neutralizes external navigation if history is locked.
         */
        handleBackForward(event) {
            if (!state._historyLocked) return;
            const step = event.state?.step ?? state.currentStep;
            UI.showStep(step, false);
            history.pushState({ step }, "", window.location.href);
        },

        /**
         * Attaches event listeners to primary interactive elements.
         */
        bindEvents() {
            document.getElementById("upload")?.addEventListener("change", (e) => this.handleFileUpload(e));
            document.getElementById("back-btn")?.addEventListener("click", () => UI.showStep(0));
            document.getElementById("continue-btn")?.addEventListener("click", () => this.handleSetTarget());
        },

        /**
         * Handles file selection, upload progress, and initial data fetching.
         * @param {Event} e 
         */
        async handleFileUpload(e) {
            const file = e.target.files?.[0];
            if (!file) return;

            UI.setFileName(file.name);
            UI.elements.loadingState?.classList.remove("hidden");
            UI.updateProgress(0, "Starting upload...");

            try {
                // 1. Process File Upload
                const data = await API.uploadFile(file, (percent) => {
                    UI.updateProgress(percent, percent < 100 ? "Uploading..." : "Syncing...");
                });

                state.datasetId = data.dataset_id;

                // 2. Load Dataset Preview
                const preview = await API.fetchPreview(state.datasetId);
                UI.renderPreview(preview);
                UI.showStep(1);

            } catch (err) {
                UI.notifyError(err.message || "Failed to process dataset.");
                UI.setFileName(""); // Reset on failure
            } finally {
                UI.elements.loadingState?.classList.add("hidden");
            }
        },

        /**
         * Finalizes the target selection and redirects to the analysis dashboard.
         */
        async handleSetTarget() {
            const target = UI.elements.targetSelect?.value;
            if (!state.datasetId || !target) {
                return UI.notifyError("Please select a target column.");
            }

            UI.toggleOverlay(true, "Updating target...");
            UI.elements.continueBtn.disabled = true;

            try {
                await API.setTarget(state.datasetId, target);

                UI.toggleOverlay(true, "Launching dashboard...");
                
                // Controlled redirect to the final dashboard view
                setTimeout(() => {
                    state._historyLocked = false;
                    window.location.href = `/dashboard/${encodeURIComponent(state.datasetId)}`;
                }, CONFIG.DASHBOARD_REDIRECT_DELAY);

            } catch (err) {
                UI.notifyError(err.message);
                UI.toggleOverlay(false);
                UI.elements.continueBtn.disabled = false;
            }
        }
    };

    // Entry point
    App.init();
})();
