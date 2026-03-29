export const UI = {
    setCurrentFile(name) {
        const el = document.getElementById("current-file");
        if (el) el.textContent = name;
    },

    setLoadingState() {
        // Set a global loading state for specific metrics
        const ids = ["rows", "cols", "duplicates", "quality-score", "ml-readiness", "target-column-display"];
        ids.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.textContent = "...";
        });
        
        const suggs = document.getElementById("suggestions");
        if (suggs) suggs.innerHTML = '<div class="spinner-border spinner-border-sm text-primary"></div> Analyzing dataset...';
    },

    updateMetrics(data) {
        const summary = data.summary || {};
        const setVal = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.textContent = val ?? "--";
        };

        setVal("rows", summary.rows?.toLocaleString());
        setVal("cols", summary.cols);
        setVal("duplicates", (summary.duplicatesPercent ?? 0) + "%");
        setVal("quality-score", summary.quality_score ?? data.quality_score);
        setVal("ml-readiness", summary.ml_readiness ?? data.ml_readiness);

        const missingVal = summary.missingPercent || 0;
        const missingEl = document.getElementById("missing-stat");
        if (missingEl) {
            missingEl.textContent = missingVal + "%";
            missingEl.style.color = missingVal > 10 ? "#ef4444" : "#1a5fb4";
        }
    },

    updateImbalance(imb) {
        const alertEl = document.getElementById("imbalance-alert");
        if (alertEl) alertEl.style.display = imb?.is_imbalanced ? "inline-block" : "none";

        const targetEl = document.getElementById("target-column-display");
        if (targetEl) {
            // Fix: If analysis is processing, show "Analyzing..." instead of "None"
            if (!imb || Object.keys(imb).length === 0) {
                targetEl.textContent = "Analyzing...";
            } else {
                targetEl.textContent = imb.target_column || "Not Set";
            }
        }
    },

    updateSuggestions(list) {
        const el = document.getElementById("suggestions");
        if (!el) return;
        
        el.innerHTML = list?.length 
            ? list.map(s => `<div class="suggestion-item"><span>💡</span> ${s}</div>`).join("")
            : `<p class="text-muted">No suggestions at this time.</p>`;
    },

    updateOutliers(outliers) {
        const el = document.getElementById("outliers-list");
        if (!el) return;
        
        const cols = Object.keys(outliers || {}).filter(k => outliers[k].count > 0);
        el.innerHTML = cols.length
            ? cols.map(name => `<span class="issue-tag">⚠️ Outliers: ${name}</span>`).join("")
            : `<span class="badge" style="background:#dcfce7; color:#166534">✅ No Critical Issues</span>`;
    },

    updateStats(incomingData) {
        const container = document.getElementById("stats-container");
        if (!container) return;

        // If the backend returned a processing status, show a spinner
        if (incomingData.status === "processing") {
            container.innerHTML = `
                <div class="text-center p-5">
                    <div class="spinner-border text-primary mb-3"></div>
                    <p>Generating statistical summary...</p>
                </div>`;
            return;
        }

        const statsData = incomingData.statistics ? incomingData.statistics : incomingData;
        const entries = Object.entries(statsData || {});
        
        if (entries.length === 0) {
            container.innerHTML = `<p class="text-muted">No statistical data available yet.</p>`;
            return;
        }

        const numericCols = entries.filter(([_, s]) => s.mean !== null);
        //const categoricalCols = entries.filter(([_, s]) => s.mean === null);

        const fmt = (val) => (val !== null && val !== undefined) 
            ? val.toLocaleString(undefined, { maximumFractionDigits: 2 }) 
            : '--';

        let html = '';
        /*

        if (categoricalCols.length > 0) {
            html += `
                <h4 class="mt-4 mb-2">Categorical Summary</h4>
                <table class="stats-table mb-4">
                    <thead>
                        <tr>
                            <th>Feature</th>
                            <th>Unique</th>
                            <th>Top Entry</th>
                            <th>Freq</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${categoricalCols.map(([name, s]) => `
                            <tr>
                                <td><strong style="color: #1a5fb4;">${name.replace(/_/g, ' ')}</strong></td>
                                <td>${s.unique ?? '--'}</td>
                                <td title="${s.top}">${s.top || '--'}</td>
                                <td>${s.freq ?? '--'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>`;
        }
        */

        if (numericCols.length > 0) {
            html += `
                <table class="stats-table">
                    <thead>
                        <tr>
                            <th>Feature</th>
                            <th>Mean</th>
                            <th>Std Dev</th>
                            <th>Min</th>
                            <th>Median</th>
                            <th>Max</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${numericCols.map(([name, s]) => `
                            <tr>
                                <td><strong style="color: #1a5fb4;">${name.replace(/_/g, ' ')}</strong></td>
                                <td>${fmt(s.mean)}</td>
                                <td>${typeof s.std === 'number' ? s.std.toFixed(2) : '--'}</td>
                                <td>${fmt(s.min)}</td>
                                <td>${fmt(s["50%"])}</td> 
                                <td>${fmt(s.max)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>`;
        }

        container.innerHTML = html;
    }
};
