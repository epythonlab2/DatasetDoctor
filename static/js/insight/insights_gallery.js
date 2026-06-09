/**
 * Insights Gallery Module (Upgraded Architecture)
 * - State-driven rendering
 * - Race-safe API calls
 * - Debounced search
 * - Clean separation of concerns
 */

import { API } from '../api.js';
import { escapeHtml } from '../utils/utils.js';

// =========================
// STATE
// =========================
let state = {
    data: [],
    category: "all",
    search: ""
};

// Request control (prevents stale renders)
let controller = null;

// Debounce control
let searchTimer = null;


const getEl = (id) => document.getElementById(id);

// =========================
// TEMPLATES
// =========================
const createInsightCard = (item, index) => `
<a href="/insights/${escapeHtml(item.slug)}"
   class="insight-card"
   style="animation-delay:${index * 0.06}s">
    <div class="card-img-box">
        <span class="card-tag">${escapeHtml(item.category || 'General')}</span>
        <img src="${escapeHtml(item.image_url || '/static/placeholder.png')}" 
             alt="${escapeHtml(item.title)}"
             loading="lazy">
    </div>
    <div class="card-body">
        <h3>${escapeHtml(item.title)}</h3>
        <p>${escapeHtml((item.content || "").slice(0, 110))}...</p>
    </div>
</a>
`;

const createFeaturedTemplate = (item) => `
<div class="featured-img-wrapper">
    <img src="${escapeHtml(item.image_url)}"
         alt="${escapeHtml(item.title)}"
         class="featured-img"
         loading="lazy">
</div>

<div class="featured-content">
    <h2>${escapeHtml(item.title)}</h2>
    <p>${escapeHtml((item.content || "").slice(0, 160))}...</p>

    <a href="/insights/${escapeHtml(item.slug)}" class="btn btn-primary">
        Read Full Guide <i data-lucide="arrow-right" size="16"></i>
    </a>
</div>
`;

// =========================
// CORE LOGIC
// =========================
export async function fetchAndRender() {
    const grid = getEl("insightsGrid");

    // cancel previous request (important fix)
    if (controller) controller.abort();
    controller = new AbortController();

    try {
        const data = await API.getInsights({ signal: controller.signal });

        state.data = Array.isArray(data) ? data : [];

        render();
    } catch (err) {
        if (err.name === "AbortError") return;

        console.error("Fetch failed:", err);
        renderError();
    }
}

// =========================
// RENDER ENGINE
// =========================
export function render() {
    const grid = getEl("insightsGrid");
    const featuredSection = getEl("featuredSection");
    const emptyState = getEl("emptyState");

    if (!grid) return;

    const { data, category, search } = state;

    const query = search.toLowerCase();

    const featured = data.find(i => i.featured);

    const isDefault = category === "all" && !search;

    const filtered = data.filter(item => {
        const matchCategory = category === "all" || item.category === category;
        const matchSearch = !query || item.title?.toLowerCase().includes(query);
        const excludeFeatured = isDefault ? item.id !== featured?.id : true;

        return matchCategory && matchSearch && excludeFeatured;
    });

    // FEATURED
    if (featuredSection) {
        if (featured && isDefault) {
            featuredSection.style.display = "grid";
            featuredSection.innerHTML = createFeaturedTemplate(featured);
        } else {
            featuredSection.style.display = "none";
        }
    }

    // EMPTY STATE
    if (emptyState) {
        emptyState.style.display = filtered.length ? "none" : "block";
    }

    // GRID
    grid.innerHTML = filtered.length
        ? filtered.map(createInsightCard).join("")
        : "";

    // icons re-init (safe)
    requestAnimationFrame(() => {
        lucide?.createIcons();
    });
}

// =========================
// ERROR STATE
// =========================
function renderError() {
    const grid = getEl("insightsGrid");

    if (!grid) return;

    grid.innerHTML = `
        <div style="text-align:center;padding:3rem;color:var(--text-muted)">
            <h3>Failed to load insights</h3>
            <p>Please refresh the page or try again later.</p>
        </div>
    `;
}

// =========================
// STATE UPDATES
// =========================
export const setSearchQuery = (value) => {
    state.search = value;

    clearTimeout(searchTimer);
    searchTimer = setTimeout(render, 150); // performance optimization
};

export const setActiveCategory = (cat) => {
    state.category = cat;
    render();
};
