/**
 * DatasetDoctor Dashboard Logic
 * Unified with Modern Canvas UI
 */

let missingChart = null;
let imbalanceChart = null;
let datasetId = null;
let globalColumns = [];
let globalOutliers = {};
let totalRows = 0;

// Helper to construct absolute URL for fetch
function getAbsoluteUrl(path) {
    const origin = window.location.origin;
    return origin + (path.startsWith('/') ? '' : '/') + path;
}

// --------------------
// Initialization
// --------------------
document.addEventListener("DOMContentLoaded", async () => {
    lucide.createIcons();
    
    const parts = window.location.pathname.split("/");
    datasetId = parts[parts.length - 1];

    if (!datasetId || datasetId === "dashboard" || datasetId.includes("blob:")) {
        datasetId = "preview-dataset";
    }

    loadData();
    document.getElementById("current-file").textContent = "current_dataset.csv";
});

/**
 * Main data loader with polling support for background tasks
 */
async function loadData() {
    try {
        const analysisUrl = getAbsoluteUrl(`/analysis/${datasetId}`);
        const res = await fetch(analysisUrl);
        if (!res.ok) throw new Error("Network response was not ok");
        const data = await res.json();

        // If backend is still processing in background, poll every 3 seconds
        if (data.status === "processing") {
            document.getElementById("rows").textContent = "Analyzing...";
            setTimeout(loadData, 3000);
            return;
        }

        initDashboard(data);
    } catch (err) {
        console.warn("Using fallback data due to fetch error:", err.message);
        initDashboard(fallbackData);
    }
}

function initDashboard(data) {
    globalColumns = data.columns || [];
    globalOutliers = data.outliers || {};
    totalRows = data.summary?.rows || 0;

    // Update Top Metric Cards
    document.getElementById("rows").textContent = totalRows.toLocaleString();
    document.getElementById("cols").textContent = data.summary?.cols || 0;
    document.getElementById("duplicates").textContent = (data.summary?.duplicatesPercent || 0) + "%";
    
    // Scores
    document.getElementById("quality-score").innerText = data.summary?.quality_score ?? data.quality_score ?? "--";
    document.getElementById("ml-readiness").innerText = data.summary?.ml_readiness ?? data.ml_readiness ?? "--";

    // Missing Stats Styling
    const missingEl = document.getElementById("missing-stat");
    const missingVal = data.summary?.missingPercent || 0;
    missingEl.textContent = missingVal + "%";
    missingEl.style.color = missingVal > 10 ? "var(--danger)" : "";

    // --- Handling the Imbalance Warning & Target Display ---
    const imb = data.imbalance || {};
    const alertEl = document.getElementById("imbalance-alert");
    
    // Update Badge visibility
    if (alertEl) {
        alertEl.style.display = imb.is_imbalanced ? "inline-block" : "none";
    }

    // Update Target Name in Header if element exists
    const targetHeader = document.getElementById("target-column-display");
    if (targetHeader) {
        targetHeader.textContent = imb.target_column || "None";
    }

    // Render Visualizations
    renderMissingChart(globalColumns.map(c => c.name), globalColumns.map(c => c.missingPercent));
    renderImbalanceChart(imb);
    
    // Update AI Suggestions
    const sugDiv = document.getElementById("suggestions");
    if (data.suggestions?.length > 0) {
        sugDiv.innerHTML = data.suggestions
            .map(s => `<div class="suggestion-item"><span>💡</span> ${s}</div>`)
            .join("");
    } else {
        sugDiv.innerHTML = `<p class="text-muted">No suggestions at this time.</p>`;
    }

    // Update Critical Issues
    const issueDiv = document.getElementById("outliers-list");
    const outlierCols = Object.keys(globalOutliers).filter(key => globalOutliers[key].count > 0);
    
    if (outlierCols.length > 0) {
        issueDiv.innerHTML = outlierCols
            .map(name => `<span class="issue-tag">⚠️ Outliers: ${name}</span>`)
            .join("");
    } else {
        issueDiv.innerHTML = `<span class="badge" style="background:#dcfce7; color:#166534">✅ No Critical Issues</span>`;
    }

    switchTableTab('health');
}

// --------------------
// Table Switching Logic
// --------------------
function switchTableTab(mode) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.toggle('active', btn.id === `tab-${mode}`));

    const thead = document.getElementById("table-head");
    const tbody = document.getElementById("table-body");
    if (!thead || !tbody) return;

    tbody.innerHTML = "";

    if (mode === 'health') {
        thead.innerHTML = `<tr><th>Column</th><th>Type</th><th>Missing %</th><th>Status</th></tr>`;
        const missingCols = globalColumns.filter(col => col.missingPercent > 0);

        if (missingCols.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:3rem; color:var(--text-muted);">🎉 Data is 100% complete!</td></tr>`;
        } else {
            missingCols.forEach(col => {
                const severity = col.missingPercent > 50 ? 'danger' : 'warning';
                // Inline styles preserved to respect your existing class logic
                const colors = severity === 'danger' ? {bg:'#fee2e2', text:'#991b1b'} : {bg:'#fef9c3', text:'#854d0e'};
                
                tbody.innerHTML += `
                    <tr>
                        <td><strong>${col.name}</strong></td>
                        <td><code>${col.type}</code></td>
                        <td>${col.missingPercent}%</td>
                        <td><span class="badge" style="background:${colors.bg}; color:${colors.text}">${severity.toUpperCase()}</span></td>
                    </tr>`;
            });
        }
    } 
    else if (mode === 'outliers') {
        thead.innerHTML = `<tr><th>Column</th><th>Type</th><th>Outlier Count</th><th>Action</th></tr>`;
        const outlierCols = globalColumns.filter(col => (globalOutliers[col.name]?.count || 0) > 0);

        if (outlierCols.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:3rem; color:var(--text-muted);">✅ No statistical outliers detected.</td></tr>`;
        } else {
            outlierCols.forEach(col => {
                tbody.innerHTML += `
                    <tr>
                        <td><strong>${col.name}</strong></td>
                        <td><code>${col.type}</code></td>
                        <td><span style="color:var(--danger); font-weight:700;">${globalOutliers[col.name].count} rows</span></td>
                        <td><button class="btn btn-secondary" style="padding:4px 10px; font-size:12px;" onclick="cleanDataset()">Clean Column</button></td>
                    </tr>`;
            });
        }
    } 
    else if (mode === 'categorical') {
        const filteredCols = globalColumns.filter(col => col.type === 'str' || col.type === 'object');
        thead.innerHTML = `<tr><th>Column</th><th>Type</th><th>Unique Values</th><th>Cardinality</th></tr>`;

        filteredCols.forEach(col => {
            const isHigh = totalRows > 0 && (col.unique / totalRows) > 0.5;
            tbody.innerHTML += `
                <tr>
                    <td><strong>${col.name}</strong></td>
                    <td><code>${col.type}</code></td>
                    <td>${col.unique.toLocaleString()}</td>
                    <td>
                        <span class="badge" style="background:${isHigh ? '#fef9c3' : '#dcfce7'}; color:${isHigh ? '#854d0e' : '#166534'}">
                            ${isHigh ? 'High' : 'Optimal'}
                        </span>
                    </td>
                </tr>`;
        });
    }
}

// --------------------
// Charts
// --------------------
function renderMissingChart(labels, data) {
    const ctx = document.getElementById("missingChart")?.getContext("2d");
    if (!ctx) return;
    if (missingChart) missingChart.destroy();
    missingChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: 'Missing %',
                data,
                backgroundColor: '#4f46e5',
                borderRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { 
                y: { beginAtZero: true, max: 100, ticks: { callback: v => v + '%' } },
                x: { grid: { display: false } } 
            }
        }
    });
}

function renderImbalanceChart(imbalanceData) {
    const ctx = document.getElementById("imbalanceChart")?.getContext("2d");
    if (!ctx) return;
    if (imbalanceChart) imbalanceChart.destroy();

    // Extract distribution dictionary safely
    const dist = imbalanceData?.distribution || {};
    const labels = Object.keys(dist);
    const values = Object.values(dist);

    if (labels.length === 0) {
        ctx.textAlign = 'center';
        ctx.fillStyle = '#64748b';
        ctx.fillText('Select a target to view distribution', ctx.canvas.width/2, ctx.canvas.height/2);
        return;
    }

    imbalanceChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: values,
                backgroundColor: labels.length <= 2 ? ['#4f46e5', '#ef4444'] : ['#4f46e5', '#10b981', '#f59e0b', '#8b5cf6'],
                hoverOffset: 4,
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '70%',
            plugins: {
                legend: { position: 'bottom', labels: { usePointStyle: true, padding: 20 } }
            }
        }
    });
}

// --------------------
// Action Handlers
// --------------------
async function cleanDataset() {
    const btn = event.target;
    const originalText = btn.innerHTML;
    btn.innerHTML = "Cleaning...";
    btn.disabled = true;

    try {
        const cleanUrl = getAbsoluteUrl(`/clean/${datasetId}`);
        const res = await fetch(cleanUrl);
        if (res.ok) alert("✨ Dataset successfully cleaned! Please refresh or export.");
        else throw new Error();
    } catch {
        alert("✨ [Preview] Auto-cleaning simulated: duplicates removed and missing values imputed.");
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

function resetAnalysis() {
    if (confirm("Reset analysis and delete uploaded data?")) {
        fetch(getAbsoluteUrl("/reset"), { method: "POST" })
            .then(res => res.ok ? window.location.href = "/" : null)
            .catch(() => window.location.reload());
    }
}

function exportDataset() {
    window.location.href = getAbsoluteUrl(`/export/${datasetId}`);
}
