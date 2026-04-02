/**
 * Table Module
 * Manages the dynamic generation of diagnostic tables.
 * Handles tab switching and conditional UI rendering based on column health.
 */
import { state } from "./state.js";

export const Table = {
    /**
     * Orchestrates the switching of table views.
     * Updates button active states and clears/re-populates the DOM.
     * @param {('health'|'outliers'|'categorical')} mode - The diagnostic view to display.
     */
    switch(mode) {
        // 1. Update UI Active States
        document.querySelectorAll('.tab-btn')
            .forEach(btn => btn.classList.toggle('active', btn.id === `tab-${mode}`));

        const thead = document.getElementById("table-head");
        const tbody = document.getElementById("table-body");
        
        // Safety check for DOM availability
        if (!thead || !tbody) return;

        // Clear existing content before rendering new mode
        tbody.innerHTML = "";

        // 2. Delegate rendering based on selected mode
        if (mode === "health") Table.renderHealth(tbody, thead);
        if (mode === "outliers") Table.renderOutliers(tbody, thead);
        if (mode === "categorical") Table.renderCategorical(tbody, thead);
    },

    /**
     * Renders the Data Health view.
     * Focuses on missing values and data completeness.
     * @param {HTMLElement} tbody - The table body container.
     * @param {HTMLElement} thead - The table head container.
     */
    renderHealth(tbody, thead) {
        thead.innerHTML = `<tr><th>Column</th><th>Type</th><th>Missing %</th><th>Status</th></tr>`;

        // Filter for columns that actually have missing values
        const cols = state.columns.filter(c => c.missingPercent > 0);

        // Empty state logic
        if (!cols.length) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="4" style="text-align:center; padding:3rem; color:var(--text-muted);">
                        🎉 Data is 100% complete!
                    </td>
                </tr>`;
            return;
        }

        cols.forEach(col => {
            // Severity Logic: >50% missing is considered high risk (Danger)
            const severity = col.missingPercent > 50 ? 'danger' : 'warning';
            const colors = severity === 'danger'
                ? { bg: '#fee2e2', text: '#991b1b' }
                : { bg: '#fef9c3', text: '#854d0e' };

            tbody.innerHTML += `
                <tr>
                    <td><strong>${col.name}</strong></td>
                    <td><code>${col.type}</code></td>
                    <td>${col.missingPercent}%</td>
                    <td>
                        <span class="badge" style="background:${colors.bg}; color:${colors.text}">
                            ${severity.toUpperCase()}
                        </span>
                    </td>
                </tr>`;
        });
    },

    /**
     * Renders the Outliers view.
     * Identifies numerical columns with values outside the statistical norm.
     * @param {HTMLElement} tbody - The table body container.
     * @param {HTMLElement} thead - The table head container.
     */
    renderOutliers(tbody, thead) {
        thead.innerHTML = `<tr><th>Column</th><th>Type</th><th>Outlier Count</th><th>Action</th></tr>`;

        // Filter columns where the backend detected at least one outlier
        const cols = state.columns.filter(c => (state.outliers[c.name]?.count || 0) > 0);

        if (!cols.length) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="4" style="text-align:center; padding:3rem; color:var(--text-muted);">
                        ✅ No statistical outliers detected.
                    </td>
                </tr>`;
            return;
        }

        cols.forEach(col => {
            tbody.innerHTML += `
                <tr>
                    <td><strong>${col.name}</strong></td>
                    <td><code>${col.type}</code></td>
                    <td>
                        <span style="color:var(--danger); font-weight:700;">
                            ${state.outliers[col.name].count} rows
                        </span>
                    </td>
                    <td>
                        <button class="btn btn-secondary" 
                                style="padding:4px 10px; font-size:12px;"
                                onclick="cleanDataset()">
                            Clean Column
                        </button>
                    </td>
                </tr>`;
        });
    },

    /**
     * Renders the Categorical Analysis view.
     * Evaluates high cardinality strings which can be problematic for ML models.
     * @param {HTMLElement} tbody - The table body container.
     * @param {HTMLElement} thead - The table head container.
     */
    renderCategorical(tbody, thead) {
        thead.innerHTML = `<tr><th>Column</th><th>Type</th><th>Unique Values</th><th>Cardinality</th></tr>`;

        // Filter for string/object types
        const cols = state.columns.filter(c => c.type === 'str' || c.type === 'object');

        cols.forEach(col => {
            // High Cardinality Logic: If unique values > 50% of total rows
            const isHigh = state.totalRows > 0 && (col.unique / state.totalRows) > 0.5;

            tbody.innerHTML += `
                <tr>
                    <td><strong>${col.name}</strong></td>
                    <td><code>${col.type}</code></td>
                    <td>${col.unique.toLocaleString()}</td>
                    <td>
                        <span class="badge" 
                              style="background:${isHigh ? '#fef9c3' : '#dcfce7'}; 
                                     color:${isHigh ? '#854d0e' : '#166534'}">
                            ${isHigh ? 'High' : 'Optimal'}
                        </span>
                    </td>
                </tr>`;
        });
    },
     /**
     * Renders the Global Statistical Summary.
     * Moved from UI to Table to ensure layout parity with diagnostic tabs.
     */
    renderGlobalStats(tbody, thead) {
        // Set Headers to match your HTML request: Feature, Mean, Std Dev, Median
        thead.innerHTML = `
            <tr>
                <th>Feature</th>
                <th>Mean</th>
                <th>Std Dev</th>
                <th>Median</th>
            </tr>`;

        const statsData = state.statistics || {};
        const entries = Object.entries(statsData);
        
        // Filter for columns that have numerical statistical moments
        const numericCols = entries.filter(([_, s]) => s.mean !== null);

        if (numericCols.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" class="text-center p-4 text-muted">No numerical features detected.</td></tr>`;
            return;
        }

        const fmt = (val) => (val !== null && val !== undefined) 
            ? val.toLocaleString(undefined, { maximumFractionDigits: 2 }) 
            : '--';

        tbody.innerHTML = numericCols.map(([name, s]) => `
            <tr>
                <td><strong style="color: var(--primary);">${name.replace(/_/g, ' ')}</strong></td>
                <td>${fmt(s.mean)}</td>
                <td>${typeof s.std === 'number' ? s.std.toFixed(2) : '--'}</td>
                <td>${fmt(s["50%"])}</td> 
            </tr>
        `).join('');
    }
};
