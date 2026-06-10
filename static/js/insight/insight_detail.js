import { API } from '../api.js';
import { escapeHtml } from '../utils/utils.js';
import { initAdSense, injectAdIntoContainer } from '../utils/ads.js';

/**
 * Fetches the main article content and renders it.
 */
export async function loadArticleDetail(slug) {
    const hero = document.getElementById("article-hero");
    const body = document.getElementById("article-body");
    const sidebarList = document.getElementById("takeaways-list");

    try {
        const insight = await API.getInsightBySlug(slug);
        if (!insight) throw new Error("Article not found");

        // 1. Render Hero
        hero.innerHTML = `
            <div class="content-width">
                <span class="category-badge">${escapeHtml(insight.category || 'General')}</span>
                <h1 class="article-title">${escapeHtml(insight.title)}</h1>
                <div class="article-meta">
                    <div class="meta-item"><i data-lucide="user"></i> Epython Lab</div>
                    <div class="meta-item"><i data-lucide="calendar"></i> ${escapeHtml(insight.date_formatted || 'N/A')}</div>
                    <div class="meta-item"><i data-lucide="clock"></i> 10 min read</div>
                </div>
            </div>
        `;

        // 2. Render Body
        body.innerHTML = `
            <div class="content-width prose">
                <img src="${escapeHtml(insight.image_url || '/static/placeholder.png')}" 
                     alt="${escapeHtml(insight.title)}" 
                     class="feature-image" />
                ${insight.content}
            </div>
        `;

        // 3. Render Dynamic Takeaways
        if (sidebarList) {
            const takeaways = Array.isArray(insight.takeaways) 
                ? insight.takeaways 
                : (insight.takeaways || "").split('\n').filter(t => t.trim() !== "");

            if (takeaways.length > 0) {
                sidebarList.innerHTML = takeaways.map(point => `
                    <li>
                        <i data-lucide="check-circle-2" class="takeaway-icon" style="color:var(--primary);"></i>
                        <span>${escapeHtml(point)}</span>
                    </li>
                `).join("");
            } else {
                const widget = sidebarList.closest('.sidebar-widget');
                if (widget) widget.style.display = 'none';
            }
        }

        // 4. Handle AdSense Integration
        initAdSense();
        const prose = body.querySelector('.prose');
        const paragraphs = prose.querySelectorAll('p');
        
        // Insert Ad after the 2nd paragraph if available
        if (paragraphs.length >= 2) {
            const adContainer = document.createElement('div');
            adContainer.className = 'ad-container';
            paragraphs[1].after(adContainer);
            injectAdIntoContainer(adContainer, 'YOUR_SPECIFIC_SLOT_ID');
        }

        // Final UI Updates
        if (window.lucide) lucide.createIcons();

    } catch (err) {
        console.error("Error loading article:", err);
        body.innerHTML = `<div class="content-width error-state">Failed to load article content.</div>`;
    }
}

/**
 * Fetches and renders related insights as an editorial list.
 */
export async function fetchRelatedInsights(slug) {
    const listContainer = document.getElementById("related-list");
    const header = document.getElementById("header_text");
    const section = listContainer.closest('.related-articles');
    
    if (!listContainer) return;

    try {
        const related = await API.getRelatedInsights(slug);
        
        // Hide the entire section if no related items are found
        if (!related || related.length === 0) {
            if (section) section.style.display = 'none';
            return;
        }
        
        // Ensure section is visible
        if (section) section.style.display = 'block';
        if (header) header.textContent = "Related Insights";

        // Map the items to the new editorial list structure
        listContainer.innerHTML = related.map(item => `
            <a href="/insights/${escapeHtml(item.slug)}" class="related-item">
                <h3>${escapeHtml(item.title)}</h3>
                <span>${escapeHtml(item.category || 'General')} &rarr;</span>
            </a>
        `).join("");
        
    } catch (err) {
        console.error("Related Error:", err);
        if (section) section.style.display = 'none';
    }
}

