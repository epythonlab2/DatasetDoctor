/**
 * Table Module
 * Manages the dynamic generation of diagnostic tables.
 * Handles tab switching and conditional UI rendering based on column health.
 */
import { state } from "../utils/state.js";

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
     * Renders the Global Statistical Summary with Interpretability Signal.
     */
    renderGlobalStats(tbody, thead) {
    thead.innerHTML = `
        <tr>
            <th>Feature</th>
            <th>Mean</th>
            <th>Std Dev</th>
            <th>Median</th>
            <th style="width: 200px;">Predictive Signal</th>
        </tr>`;

    const statsData = state.statistics || {};
    const powerData = state.predictivePower || {};
    const entries = Object.entries(statsData);
    const numericCols = entries.filter(([_, s]) => s && s.mean !== null);

    if (numericCols.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center p-5 text-muted">No numerical features detected.</td></tr>`;
        return;
    }

    const fmt = (val) => (val !== null && val !== undefined) 
        ? val.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '--';

    tbody.innerHTML = numericCols.map(([name, s]) => {
        const featureInfo = powerData[name] || {};
        const safeScore = parseFloat(featureInfo.score) || 0;
        const flags = featureInfo.flags || [];
        const miValue = featureInfo.mi !== undefined ? featureInfo.mi.toFixed(4) : '0.0000';

        let signalHTML = '', statusColor = '', explanation = '';

        if (flags.includes('leakage_risk') || safeScore > 0.5) {
            signalHTML = `<span class="badge bg-danger">🔥 Leakage</span>`;
            statusColor = '#dc3545'; // Danger Red
            explanation = `High information overlap. This feature effectively "contains the answer," leading to artificial accuracy.`;
        } else if (safeScore > 0.1) {
            signalHTML = `<span class="badge bg-success">💎 Strong</span>`;
            statusColor = '#198754'; // Success Green
            explanation = `High predictive power. This column is a reliable driver for the target variable.`;
        } else if (safeScore > 0.01) {
            signalHTML = `<span class="badge bg-primary">⚡ Moderate</span>`;
            statusColor = '#0d6efd'; // Primary Blue
            explanation = `Secondary signal. Useful for fine-tuning model performance when combined with other data.`;
        } else {
            signalHTML = `<span class="badge bg-secondary">☁️ Noise</span>`;
            statusColor = '#6c757d'; // Muted Gray
            explanation = `Weak relationship. This feature adds complexity without significant predictive benefit.`;
        }

        return `
            <tr>
                <td><strong style="color: var(--primary);">${name.replace(/_/g, ' ')}</strong></td>
                <td>${fmt(s.mean)}</td>
                <td>${typeof s.std === 'number' ? s.std.toFixed(2) : '--'}</td>
                <td>${fmt(s["50%"])}</td>
                <td style="position: relative;"> <div class="d-flex align-items-center gap-2">
                        ${signalHTML}
                        
                        <button class="info-icon-trigger" 
                                onclick="event.stopPropagation(); this.nextElementSibling.classList.toggle('show')"
                                style="color: ${statusColor};">
                            <i data-lucide="info" style="width:16px; height:16px;"></i>
                        </button>

                        <div class="info-card-overlay shadow-lg border rounded bg-white">
                            <div class="info-card-header" style="background: ${statusColor}15; border-bottom: 1px solid ${statusColor}25;">
                                <span style="color: ${statusColor}; font-weight: 700; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px;">
                                    Statistical Insight
                                </span>
                            </div>
                            <div class="info-card-body">
                                <p class="mb-0 text-dark" style="font-size: 13px; line-height: 1.4;">${explanation}</p>
                            </div>
                            <div class="info-card-footer">
                                <div class="d-flex justify-content-between">
                                    <span class="stat-label">MI Score: <strong>${miValue}</strong></span>
                                    <span class="stat-label">Power: <strong>${safeScore.toFixed(3)}</strong></span>
                                </div>
                            </div>
                        </div>
                    </div>
                </td>
            </tr>`;
    }).join('');

    // Close on outside click
    document.addEventListener('click', () => {
        document.querySelectorAll('.info-card-overlay.show').forEach(p => p.classList.remove('show'));
    }, { once: false });

    if (window.lucide) lucide.createIcons();
}
};
