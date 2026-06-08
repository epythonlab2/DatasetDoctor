/**
 * Insights Gallery Module
 * Manages the state and UI rendering for the insights dashboard.
 */
import { API } from '../api.js';

let insightsData = [];
let activeCategory = "all";
let searchQuery = "";

/**
 * Renders loading placeholders while waiting for the API.
 */
function showLoadingState() {
    const grid = document.getElementById("insightsGrid");
    if (!grid) return;
    
    // Create 6 skeleton cards
    grid.innerHTML = Array(6).fill(0).map(() => `
        <div class="insight-card skeleton"></div>
    `).join("");
}

/**
 * Fetches the complete list of insights from the API and initializes the view.
 */
export async function fetchAndRender() {
    showLoadingState(); // Show skeletons immediately
    try {
        insightsData = await API.getInsights();
        renderInsights();
    } catch (err) {
        console.error("Gallery Error:", err);
        const grid = document.getElementById("insightsGrid");
        if (grid) grid.innerHTML = "<p>Failed to load insights. Please try again later.</p>";
    }
}

/**
 * Filters the internal dataset based on search/category and updates the DOM.
 */
export function renderInsights() {
    const grid = document.getElementById("insightsGrid");
    const emptyState = document.getElementById("emptyState");
    const featured = document.getElementById("featuredSection");

    const filtered = insightsData.filter((item) => {
        const matchesCat = activeCategory === "all" || item.category === activeCategory;
        const matchesSearch = item.title?.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesCat && matchesSearch;
    });

    // Toggle visibility of featured section and empty state
    if (featured) {
        featured.style.display = (activeCategory !== "all" || searchQuery !== "") ? "none" : "grid";
    }
    
    if (emptyState) {
        emptyState.style.display = filtered.length === 0 ? "block" : "none";
    }
    
    if (grid) {
        grid.innerHTML = filtered.map(item => `
            <a href="/insights/${item.slug}" class="insight-card">
                <div class="card-img-box">
                    <span class="card-tag">${item.category || 'General'}</span>
                    <img src="${item.image_url || '/static/placeholder.png'}" alt="${item.title}">
                </div>
                <div class="card-body">
                    <h3>${item.title}</h3>
                    <p>${(item.content || "").substring(0, 100)}...</p>
                </div>
            </a>
        `).join("");
    }

    // Refresh icons (Lucide library)
    if (window.lucide) {
        lucide.createIcons();
    }
}

/**
 * Updates the search query and triggers a UI re-render.
 * @param {string} query - The search term.
 */
export function setSearchQuery(query) {
    searchQuery = query;
    renderInsights();
}

/**
 * Updates the active category filter and triggers a UI re-render.
 * @param {string} cat - The selected category filter.
 */
export function setActiveCategory(cat) {
    activeCategory = cat;
    renderInsights();
}
