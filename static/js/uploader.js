/**
 * DataFlow Dashboard Core - Uploader
 * @description Strictly handles file ingestion and redirects to Dashboard for preview.
 */

import { initNavigationGuard } from './utils/navigationGuard.js';
import { API } from './api.js';

initNavigationGuard();

(() => {
    "use strict";

    const UI = {
        elements: {
            uploadCard: document.querySelector(".upload-card"),
            loadingState: document.getElementById("loading-state"),
            progressFill: document.getElementById("progress-fill"),
            fileNameDisplay: document.getElementById("file-name-display"),
            progressPercent: document.getElementById("progress-percent"),
            statusText: document.getElementById("status-text"),
        },

        setFileName(name) {
            if (this.elements.fileNameDisplay) {
                this.elements.fileNameDisplay.textContent = name || "";
            }
        },

        updateProgress(percent, text) {
            if (this.elements.progressFill) this.elements.progressFill.style.width = `${percent}%`;
            if (this.elements.progressPercent) this.elements.progressPercent.textContent = `${percent}%`;
            if (text && this.elements.statusText) this.elements.statusText.textContent = text;
        },

        notifyError(msg) {
            console.error(`[DataFlow Error]: ${msg}`);
            alert(msg);
        }
    };

    const App = {
        init() {
            this.bindEvents();
            document.body.style.opacity = "1";
        },

        bindEvents() {
            document.getElementById("upload")?.addEventListener("change", (e) => this.handleFileUpload(e));
        },

        async handleFileUpload(e) {
            const file = e.target.files?.[0];
            if (!file) return;

            UI.setFileName(file.name);
            UI.elements.loadingState?.classList.remove("hidden");
            UI.updateProgress(0, "Starting upload...");

            try {
                // 1. Upload File
                const data = await API.uploadFile(file, (percent) => {
                    UI.updateProgress(percent, percent < 100 ? "Uploading..." : "Processing Engine...");
                });

                // 2. Redirect to Dashboard with the ID and a 'preview' flag
                // We move the state to the URL so the Dashboard knows what to load
               // Redirect to the clean path
		const previewUrl = `/dashboard/preview/${encodeURIComponent(data.dataset_id)}`;
		window.location.href = previewUrl;

            } catch (err) {
                UI.notifyError(err.message || "Upload failed.");
                UI.setFileName("");
                UI.elements.loadingState?.classList.add("hidden");
            }
        }
    };

    App.init();
})();
