(() => {
    "use strict";

    const $ = (id) => document.getElementById(id);

    // --- NEW: Cloud-Resiliency Helper ---
    // This function will retry 404s to help hit the "Lucky" instance
    async function fetchWithRetry(url, options = {}, retries = 5) {
        for (let i = 0; i < retries; i++) {
            const res = await fetch(url, options);
            if (res.status === 404 && i < retries - 1) {
                console.warn(`[RETRY] Path 404, rolling dice for new instance... (${i + 1}/${retries})`);
                await new Promise(r => setTimeout(r, 400)); // 400ms delay
                continue;
            }
            return res; // Return the response (even if it's an error after all retries)
        }
    }

    const safeText = (value) => value === null || value === undefined ? "" : String(value);

    const showError = (message) => {
        console.error(message);
        alert(message);
    };

    window.addEventListener("load", () => {
        document.body.style.opacity = "1";
    });

    let currentStep = 0;
    const steps = document.querySelectorAll(".step");

    function updateStepperUI() {
        steps.forEach((step, i) => {
            step.classList.toggle("active", i === currentStep);
        });
    }

    function showStep(index) {
        const uploadCard = document.querySelector(".upload-card");
        const previewSection = $("preview-section");
        if (!uploadCard || !previewSection) return;

        uploadCard.classList.add("hidden");
        previewSection.classList.add("hidden");

        if (index === 0) uploadCard.classList.remove("hidden");
        if (index === 1) previewSection.classList.remove("hidden");

        currentStep = index;
        updateStepperUI();
    }

    const overlay = $("overlay-loader");
    const overlayText = $("overlay-text");

    function showOverlay(message = "Processing...") {
        if (!overlay || !overlayText) return;
        overlayText.textContent = message;
        overlay.classList.remove("hidden");
    }

    function hideOverlay() {
        overlay?.classList.add("hidden");
    }

    const progressFill = $("progress-fill");
    const progressPercent = $("progress-percent");
    const statusText = $("status-text");

    function updateProgress(percent, text) {
        if (progressFill) progressFill.style.width = `${percent}%`;
        if (progressPercent) progressPercent.textContent = `${percent}%`;
        if (text && statusText) statusText.textContent = text;
    }

    const uploadInput = $("upload");
    const loading = $("loading-state");

    if (uploadInput) {
        uploadInput.addEventListener("change", handleUpload);
    }

    function handleUpload() {
        const file = uploadInput?.files?.[0];
        if (!file) return;

        loading?.classList.remove("hidden");
        updateProgress(0, "Starting upload...");

        const formData = new FormData();
        formData.append("file", file);

        const xhr = new XMLHttpRequest();
        xhr.open("POST", "/upload", true);

        xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
                const percent = Math.round((event.loaded / event.total) * 100);
                updateProgress(percent, "Uploading...");
            }
        };

        xhr.onload = async () => {
            try {
                if (xhr.status !== 200) throw new Error("Upload failed");

                const data = JSON.parse(xhr.responseText);
                updateProgress(100, "Syncing across nodes...");

                // --- FIX 1: Retry the Preview call ---
                const res = await fetchWithRetry(`/preview/${encodeURIComponent(data.dataset_id)}`);
                if (!res.ok) throw new Error("Preview fetch failed after retries.");

                const previewData = await res.json();
                showPreview({
                    dataset_id: data.dataset_id,
                    preview: previewData
                });

                showStep(1);

            } catch (err) {
                showError(err.message);
            } finally {
                loading?.classList.add("hidden");
            }
        };

        xhr.send(formData);
    }

    function showPreview(data) {
        const table = $("preview-table");
        const select = $("target-select");
        const previewSection = $("preview-section");

        if (!table || !select || !previewSection) return;

        const { columns = [], rows = [] } = data.preview || {};
        table.innerHTML = "";
        select.innerHTML = "";

        const thead = document.createElement("thead");
        const headerRow = document.createElement("tr");
        columns.forEach(col => {
            const th = document.createElement("th");
            th.textContent = safeText(col);
            headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);

        const tbody = document.createElement("tbody");
        rows.forEach(row => {
            const tr = document.createElement("tr");
            columns.forEach(col => {
                const td = document.createElement("td");
                td.textContent = safeText(row[col]);
                tr.appendChild(td);
            });
            tbody.appendChild(tr);
        });

        table.appendChild(thead);
        table.appendChild(tbody);

        columns.forEach(col => {
            const option = document.createElement("option");
            option.value = col;
            option.textContent = col;
            select.appendChild(option);
        });

        previewSection.dataset.datasetId = data.dataset_id;
    }

    $("back-btn")?.addEventListener("click", () => showStep(0));

    $("continue-btn")?.addEventListener("click", async () => {
        const previewSection = $("preview-section");
        const datasetId = previewSection?.dataset?.datasetId;
        const target = $("target-select")?.value;

        if (!datasetId || !target) {
            showError("Please select a target column.");
            return;
        }

        showOverlay("Updating target...");
        $("continue-btn").disabled = true;

        try {
            // --- FIX 2: Retry the Set-Target call ---
            const res = await fetchWithRetry(`/set-target/${encodeURIComponent(datasetId)}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ target })
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.detail || "Failed to set target");
            }

            overlayText.textContent = "Launching dashboard...";
            setTimeout(() => {
                window.location.href = `/dashboard/${encodeURIComponent(datasetId)}`;
            }, 600);

        } catch (err) {
            showError(err.message);
            hideOverlay();
        } finally {
            $("continue-btn").disabled = false;
        }
    });

})();
