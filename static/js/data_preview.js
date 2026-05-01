/**
 * DataPreview Controller
 * Handles skeleton loading, table rendering, and target selection.
 */
import { API } from './api.js';

const UI = {
    elements: {
        table: document.getElementById("preview-table"),
        select: document.getElementById("target-select"),
        continueBtn: document.getElementById("continue-btn"),
        tableWrapper: document.querySelector(".table-preview-wrapper"),
        body: document.body
    },

    /**
     * Toggles skeleton loading state
     * @param {boolean} isLoading 
     */
    toggleLoading(isLoading) {
        if (!this.elements.tableWrapper) return;

        if (isLoading) {
            // Create 5 skeleton rows
            const skeletonRows = Array(5).fill(`
                <tr>
                    ${Array(5).fill('<td><div class="is-loading skeleton-text"></div></td>').join('')}
                </tr>
            `).join('');
            
            this.elements.table.innerHTML = `<tbody>${skeletonRows}</tbody>`;
            this.elements.continueBtn?.classList.add('is-loading');
        } else {
            this.elements.continueBtn?.classList.remove('is-loading');
        }
    },

    /**
     * Injects the dataset into the DOM
     * @param {Object} data - { columns: [], rows: [] }
     */
    render(data) {
        const { columns, rows } = data;
        if (!this.elements.table || !this.elements.select) return;

        // 1. Render Table Header
        const headerHtml = `
            <thead>
                <tr>
                    ${columns.map(col => `<th data-col="${col}">${col}</th>`).join('')}
                </tr>
            </thead>
        `;

        // 2. Render Table Body
        const bodyHtml = `
            <tbody>
                ${rows.map(row => `
                    <tr>
                        ${columns.map(col => `<td data-col="${col}">${row[col] ?? ''}</td>`).join('')}
                    </tr>
                `).join('')}
            </tbody>
        `;

        this.elements.table.innerHTML = headerHtml + bodyHtml;

        // 3. Populate Target Dropdown
        this.elements.select.innerHTML = '<option value="" disabled selected>Select target column...</option>';
        columns.forEach(col => {
            const option = document.createElement("option");
            option.value = col;
            option.textContent = col;
            this.elements.select.appendChild(option);
        });
    },

    showError(msg) {
        console.error(`[Preview Error]: ${msg}`);
        if (this.elements.tableWrapper) {
            this.elements.tableWrapper.innerHTML = `
                <div style="padding: 2rem; text-align: center; color: var(--text-muted);">
                    <i data-lucide="alert-circle" style="margin-bottom: 1rem;"></i>
                    <p>${msg}</p>
                </div>
            `;
            lucide.createIcons();
        }
    }
};

// --- Initialization ---
document.addEventListener("DOMContentLoaded", async () => {
    const datasetId = UI.elements.body.dataset.datasetId;

    if (!datasetId) {
        UI.showError("No dataset ID provided.");
        return;
    }

    try {
        UI.toggleLoading(true); // Start shimmer
        
        const data = await API.fetchPreview(datasetId);
        
        UI.toggleLoading(false); // Stop shimmer
        UI.render(data);
        
        // Re-initialize Lucide icons if any were added dynamically
        if (window.lucide) lucide.createIcons();

    } catch (err) {
        UI.toggleLoading(false);
        UI.showError("Failed to load dataset preview.");
    }
});

// --- Action Handling ---
UI.elements.continueBtn?.addEventListener("click", async () => {
    const target = UI.elements.select.value;
    const datasetId = UI.elements.body.dataset.datasetId;

    if (!target) {
        alert("Please select a target variable (y) before proceeding.");
        return;
    }

    try {
        UI.elements.continueBtn.innerText = "Processing...";
        UI.elements.continueBtn.disabled = true;

        await API.setTarget(datasetId, target);
        window.location.href = `/dashboard/${datasetId}`;
    } catch (err) {
        UI.elements.continueBtn.innerText = "Continue";
        UI.elements.continueBtn.disabled = false;
        UI.showError("Failed to set target variable.");
    }
});

/**
 * Handle Column Highlighting on Selection
 */
UI.elements.select?.addEventListener("change", (e) => {
    const selectedCol = e.target.value;
    
    // Remove previous highlights
    document.querySelectorAll('.active-col').forEach(el => el.classList.remove('active-col'));
    
    // Add new highlights to the specific column
    document.querySelectorAll(`[data-col="${selectedCol}"]`).forEach(el => {
        el.classList.add('active-col');
    });
});
