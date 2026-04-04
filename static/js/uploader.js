(() => {
    "use strict";

    // --------------------
    // Helpers
    // --------------------
    const $ = (id) => document.getElementById(id);

    const safeText = (value) => {
        return value === null || value === undefined ? "" : String(value);
    };

    const showError = (message) => {
        console.error(message);
        alert(message);
    };

    // --------------------
    // Fade in
    // --------------------
    window.addEventListener("load", () => {
        document.body.style.opacity = "1";
    });

    // --------------------
    // Stepper
    // --------------------
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

    // --------------------
    // Overlay
    // --------------------
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

    // --------------------
    // Progress
    // --------------------
    const progressFill = $("progress-fill");
    const progressPercent = $("progress-percent");
    const statusText = $("status-text");
    const fileNameDisplay = $("file-name-display");

    function updateProgress(percent, text) {
        if (progressFill) progressFill.style.width = `${percent}%`;
        if (progressPercent) progressPercent.textContent = `${percent}%`;
        if (text && statusText) statusText.textContent = text;
    }

    // --------------------
    // Upload
    // --------------------
    const uploadInput = $("upload");
    const loading = $("loading-state");

    if (uploadInput) {
        uploadInput.addEventListener("change", handleUpload);
    }

    function validateFile(file) {
        const MAX_SIZE = 200 * 1024 * 1024; // 200MB
        const allowedTypes = ["text/csv", "application/json"];

        if (file.size > MAX_SIZE) {
            showError("File too large (max 200MB).");
            return false;
        }

        if (!allowedTypes.includes(file.type)) {
            showError("Unsupported file type.");
            return false;
        }

        return true;
    }

    function handleUpload() {
        const file = uploadInput?.files?.[0];
        if (!file || !validateFile(file)) return;

        loading?.classList.remove("hidden");

        if (fileNameDisplay) fileNameDisplay.textContent = file.name;
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
                if (xhr.status !== 200) {
                    throw new Error("Upload failed");
                }

                const data = JSON.parse(xhr.responseText);

                if (!data?.dataset_id) {
                    throw new Error("Invalid server response");
                }

                updateProgress(100, "Fetching preview...");

                const res = await fetch(`/preview/${encodeURIComponent(data.dataset_id)}`);
                if (!res.ok) throw new Error("Preview fetch failed");

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

        xhr.onerror = () => {
            showError("Network error during upload.");
            loading?.classList.add("hidden");
        };

        xhr.send(formData);
    }

    // --------------------
    // Safe Table Rendering
    // --------------------
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

    // --------------------
    // Navigation
    // --------------------
    $("back-btn")?.addEventListener("click", () => showStep(0));

    $("continue-btn")?.addEventListener("click", async () => {
    const previewSection = $("preview-section");
    const datasetId = previewSection?.dataset?.datasetId;
    const target = $("target-select")?.value;

    if (!datasetId || !target) {
        showError("Please select a target column.");
        return;
    }

    showOverlay("Preparing analysis...");
    $("continue-btn").disabled = true;

    try {
        const res = await fetch(`/set-target/${encodeURIComponent(datasetId)}`, {
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
        }, 400);

    } catch (err) {
        showError(err.message);
        hideOverlay();
    } finally {
        $("continue-btn").disabled = false;
    }
});

})();