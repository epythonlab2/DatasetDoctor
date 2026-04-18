/**
 * DataFlow Dashboard Core
 * -----------------------
 * A modular approach to dataset uploading and target selection.
 */

(() => {
    "use strict";

    /* --- Constants & State --- */
    const CONFIG = {
        RETRY_ATTEMPTS: 5,
        RETRY_DELAY_MS: 400,
        DASHBOARD_REDIRECT_DELAY: 600
    };

    const state = {
        currentStep: 0,
        datasetId: null,
        _historyLocked: true
    };

    /* --- UI Engine --- */
    const UI = {
        elements: {
            uploadCard: document.querySelector(".upload-card"),
            previewSection: document.getElementById("preview-section"),
            previewTable: document.getElementById("preview-table"),
            targetSelect: document.getElementById("target-select"),
            steps: document.querySelectorAll(".step"),
            overlay: document.getElementById("overlay-loader"),
            overlayText: document.getElementById("overlay-text"),
            progressFill: document.getElementById("progress-fill"),
            progressPercent: document.getElementById("progress-percent"),
            statusText: document.getElementById("status-text"),
            continueBtn: document.getElementById("continue-btn"),
            loadingState: document.getElementById("loading-state")
        },

        showStep(index, pushHistory = true) {
            state.currentStep = index;
            const isUpload = index === 0;

            this.elements.uploadCard?.classList.toggle("hidden", !isUpload);
            this.elements.previewSection?.classList.toggle("hidden", isUpload);

            this.elements.steps.forEach((step, i) => {
                step.classList.toggle("active", i === index);
            });

            // Lock history state to current step
            if (pushHistory) {
                history.pushState({ step: index }, "", window.location.href);
            }
        },

        updateProgress(percent, text) {
            if (this.elements.progressFill) this.elements.progressFill.style.width = `${percent}%`;
            if (this.elements.progressPercent) this.elements.progressPercent.textContent = `${percent}%`;
            if (text && this.elements.statusText) this.elements.statusText.textContent = text;
        },

        toggleOverlay(show, message = "Processing...") {
            if (!this.elements.overlay) return;
            if (this.elements.overlayText) this.elements.overlayText.textContent = message;
            this.elements.overlay.classList.toggle("hidden", !show);
        },

        renderPreview(previewData) {
            const { columns = [], rows = [] } = previewData;
            const table = this.elements.previewTable;
            const select = this.elements.targetSelect;
            if (!table || !select) return;

            table.innerHTML = "";

            const thead = document.createElement("thead");
            const headerRow = document.createElement("tr");

            columns.forEach(col => {
                const th = document.createElement("th");
                th.textContent = col ?? "";
                headerRow.appendChild(th);
            });

            thead.appendChild(headerRow);
            table.appendChild(thead);

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

            table.appendChild(tbody);

            select.innerHTML = '<option value="" disabled selected>Select target column...</option>';
            columns.forEach(col => select.add(new Option(col, col)));
        },

        notifyError(msg) {
            console.error(`[Error]: ${msg}`);
            alert(msg);
        }
    };

    /* --- Data Engine --- */
    const Engine = {
        async request(url, options = {}, retries = CONFIG.RETRY_ATTEMPTS) {
            for (let i = 0; i < retries; i++) {
                try {
                    const res = await fetch(url, options);

                    if (res.status === 404 && i < retries - 1) {
                        await new Promise(r => setTimeout(r, CONFIG.RETRY_DELAY_MS));
                        continue;
                    }

                    if (!res.ok) throw new Error(`Server returned ${res.status}`);
                    return await res.json();
                } catch (err) {
                    if (i === retries - 1) throw err;
                }
            }
        },

        uploadFile(file, onProgress, onSuccess, onError) {
            const xhr = new XMLHttpRequest();
            const formData = new FormData();
            formData.append("file", file);

            xhr.upload.onprogress = (e) => {
                if (e.lengthComputable) {
                    const percent = Math.round((e.loaded / e.total) * 100);
                    onProgress(percent);
                }
            };

            xhr.onload = () =>
                xhr.status === 200
                    ? onSuccess(JSON.parse(xhr.responseText))
                    : onError("Upload failed.");

            xhr.onerror = () => onError("Network error during upload.");

            xhr.open("POST", "/upload");
            xhr.send(formData);
        }
    };

    /* --- Application Logic (Controller) --- */
    const App = {
        init() {
            this.bindEvents();

            // Initialize history lock
            history.replaceState({ step: 0 }, "", window.location.href);
            window.addEventListener("popstate", this.handleBackForward.bind(this));

            document.body.style.opacity = "1";
        },

        handleBackForward(event) {
            if (!state._historyLocked) return;

            // Force user back to current step (neutralize back/forward)
            const step = event.state?.step ?? state.currentStep;
            UI.showStep(step, false);
            history.pushState({ step }, "", window.location.href);
        },

        bindEvents() {
            document.getElementById("upload")?.addEventListener("change", (e) => this.handleFileUpload(e));
            document.getElementById("back-btn")?.addEventListener("click", () => UI.showStep(0));
            document.getElementById("continue-btn")?.addEventListener("click", () => this.handleSetTarget());
        },

        handleFileUpload(e) {
            const file = e.target.files?.[0];
            if (!file) return;

            UI.elements.loadingState?.classList.remove("hidden");
            UI.updateProgress(0, "Starting upload...");

            Engine.uploadFile(
                file,
                (percent) => UI.updateProgress(percent, percent < 100 ? "Uploading..." : "Syncing..."),
                async (data) => {
                    try {
                        state.datasetId = data.dataset_id;

                        const preview = await Engine.request(
                            `/preview/${encodeURIComponent(state.datasetId)}`
                        );

                        UI.renderPreview(preview);
                        UI.showStep(1);

                    } catch {
                        UI.notifyError("Failed to load preview.");
                    } finally {
                        UI.elements.loadingState?.classList.add("hidden");
                    }
                },
                (err) => {
                    UI.notifyError(err);
                    UI.elements.loadingState?.classList.add("hidden");
                }
            );
        },

        async handleSetTarget() {
            const target = UI.elements.targetSelect?.value;

            if (!state.datasetId || !target) {
                return UI.notifyError("Please select a target column.");
            }

            UI.toggleOverlay(true, "Updating target...");
            UI.elements.continueBtn.disabled = true;

            try {
                await Engine.request(`/set-target/${encodeURIComponent(state.datasetId)}`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ target })
                });

                UI.toggleOverlay(true, "Launching dashboard...");

                setTimeout(() => {
                    state._historyLocked = false; // unlock before navigation
                    window.location.href = `/dashboard/${encodeURIComponent(state.datasetId)}`;
                }, CONFIG.DASHBOARD_REDIRECT_DELAY);

            } catch (err) {
                UI.notifyError(err.message);
                UI.toggleOverlay(false);
                UI.elements.continueBtn.disabled = false;
            }
        }
    };

    App.init();

})();
