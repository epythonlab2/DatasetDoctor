import { API } from '../api.js';
import { escapeHtml } from '../utils/utils.js';


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
        
	// 2. Render Body FIRST
        body.innerHTML = `
            <div class="content-width prose">
                <img src="${escapeHtml(insight.image_url || '/static/placeholder.png')}" 
                     alt="${escapeHtml(insight.title)}" 
                     class="feature-image" />
                ${insight.content}
            </div>
        `;
        
        // 3. Generate Sidebar after the next browser paint
       // NEW: Render Dynamic Takeaways
        if (sidebarList) {
            // Assume insight.takeaways is an Array. 
            // If it's a string, use .split('\n')
            const takeaways = Array.isArray(insight.takeaways) 
                ? insight.takeaways 
                : (insight.takeaways || "").split('\n').filter(t => t.trim() !== "");

            if (takeaways.length > 0) {
                sidebarList.innerHTML = takeaways.map(point => `
                    <li>
                        <i data-lucide="check-circle-2" class="takeaway-icon"></i>
                        <span>${escapeHtml(point)}</span>
                    </li>
                `).join("");
            } else {
                // Hide widget if no takeaways exist
                sidebarList.closest('.sidebar-widget').style.display = 'none';
            }
        }

        requestAnimationFrame(() => generateSidebarNavigation());

        if (window.lucide) lucide.createIcons();
    } catch (err) {
        console.error("Error loading article:", err);
        body.innerHTML = `<div class="error-state">Failed to load article content.</div>`;
    }
    
    
}

/**
 * Fetches and renders related insights grid.
 */
export async function fetchRelatedInsights(slug) {
    const grid = document.getElementById("related-grid");
    const header = document.getElementById("header_text");
    
    if (!grid) return;

    try {
        const related = await API.getRelatedInsights(slug);
        
        if (!related || related.length === 0) {
            grid.parentElement.style.display = 'none'; // Hide section if empty
            return;
        }
        
        if (header) header.textContent = "Related Insights";

        grid.innerHTML = related.map(item => `
            <article class="related-card">
                <span class="category-badge">${escapeHtml(item.category || 'General')}</span>
                <h3>${escapeHtml(item.title)}</h3>
                <p>${escapeHtml(item.content?.replace(/<[^>]*>?/gm, '').substring(0, 100) || '')}...</p>
                <a href="/insights/${escapeHtml(item.slug)}">Read more &rarr;</a>
            </article>
        `).join("");
        
        if (window.lucide) lucide.createIcons();
    } catch (err) {
        console.error("Related Error:", err);
        grid.innerHTML = "<p>Could not load related insights.</p>";
    }
}

function generateSidebarNavigation() {
    const articleBody = document.getElementById('article-body');
    const sidebarList = document.getElementById('takeaways-list');
    const sidebarWidget = sidebarList.closest('.sidebar-widget');
    
    // Select H2s inside the injected .prose container
    const headings = articleBody.querySelectorAll('.prose h2');
    
    if (headings.length === 0) {
        if (sidebarWidget) sidebarWidget.style.display = 'none';
        return;
    }

    // Clear existing list to prevent duplicates
    sidebarList.innerHTML = '';

    headings.forEach((h2, index) => {
        const id = `heading-${index}`;
        h2.id = id;

        const li = document.createElement('li');
        const a = document.createElement('a');
        
        a.textContent = h2.textContent;
        a.href = `#${id}`;
        a.className = 'takeaway-link'; 

        li.appendChild(a);
        sidebarList.appendChild(li);
    });
}
