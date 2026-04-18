// ui.renderer.js

export const UIRenderer = {

  metricColor(value, mode) {
    const num = parseFloat(value);
    if (isNaN(num)) return "var(--primary)";

    if (mode === "score") {
      return num >= 80 ? "var(--success)" :
             num >= 50 ? "var(--warning)" :
                         "var(--danger)";
    }

    if (mode === "error") {
      return num > 10 ? "var(--danger)" :
             num > 5  ? "var(--warning)" :
                        "var(--primary)";
    }

    return "var(--primary)";
  },

  suggestions(list) {
    if (!list?.length) {
      return `<p class="text-muted">No specific cleanup tasks identified.</p>`;
    }

    return list.map(s =>
      `<div class="suggestion-item"><span>💡</span> ${s}</div>`
    ).join("");
  },

  outliers(outliers) {
    const cols = Object.keys(outliers || {}).filter(k => outliers[k].count > 0);

    if (!cols.length) {
      return `<span class="badge" style="background:#dcfce7; color:#166534">
                ✅ Statistical Distribution Normal
              </span>`;
    }

    return cols.map(name =>
      `<span class="issue-tag">⚠️ Outliers: ${name}</span>`
    ).join("");
  }
};
