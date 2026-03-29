import { state } from "./state.js";

export const Table = {
    switch(mode) {
        document.querySelectorAll('.tab-btn')
            .forEach(btn => btn.classList.toggle('active', btn.id === `tab-${mode}`));

        const thead = document.getElementById("table-head");
        const tbody = document.getElementById("table-body");
        if (!thead || !tbody) return;

        tbody.innerHTML = "";

        if (mode === "health") Table.renderHealth(tbody, thead);
        if (mode === "outliers") Table.renderOutliers(tbody, thead);
        if (mode === "categorical") Table.renderCategorical(tbody, thead);
    },

    // --------------------
    // HEALTH TAB
    // --------------------
    renderHealth(tbody, thead) {
        thead.innerHTML = `<tr><th>Column</th><th>Type</th><th>Missing %</th><th>Status</th></tr>`;

        const cols = state.columns.filter(c => c.missingPercent > 0);

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

    // --------------------
    // OUTLIERS TAB
    // --------------------
    renderOutliers(tbody, thead) {
        thead.innerHTML = `<tr><th>Column</th><th>Type</th><th>Outlier Count</th><th>Action</th></tr>`;

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

    // --------------------
    // CATEGORICAL TAB
    // --------------------
    renderCategorical(tbody, thead) {
        thead.innerHTML = `<tr><th>Column</th><th>Type</th><th>Unique Values</th><th>Cardinality</th></tr>`;

        const cols = state.columns.filter(c => c.type === 'str' || c.type === 'object');

        cols.forEach(col => {
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
    }
};
