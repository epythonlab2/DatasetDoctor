import { API } from '../api.js';
import { escapeHtml } from '../utils/utils.js';
import { initAdSense, injectAdIntoContainer } from '../utils/ads.js';

/**
 * Generates the HTML for Action Buttons.
 * Contains both a short label (.btn-text) and a full label (.btn-full-text) 
 * for responsive UI management.
 */
function getActionButtons() {
    return `
        <div class="action-bar">
            <button id="btn-save" class="hero-action-btn">
                <i data-lucide="bookmark"></i> 
                <span class="btn-save">Save</span>
            </button>
            <button id="btn-share" class="hero-action-btn">
                <i data-lucide="share-2"></i> 
                <span class="btn-text">Share</span>
            </button>
        </div>
    `;
}

/**
 * Fetches and renders the article detail, content, and related components.
 */
export async function loadArticleDetail(slug) {
    const hero = document.getElementById("article-hero");
    const body = document.getElementById("article-body");
    const sidebarList = document.getElementById("takeaways-list");

    try {
        const insight = await API.getInsightBySlug(slug);
        if (!insight) throw new Error("Article not found");

        // 1. Render Hero Section
        hero.innerHTML = `
            <div class="content-width">
                <span class="category-badge">${escapeHtml(insight.category || 'General')}</span>
                <h1 class="article-title">${escapeHtml(insight.title)}</h1>
                <div class="article-meta">
                    <div class="meta-item"><i data-lucide="user"></i> Epython Lab</div>
                    <div class="meta-item"><i data-lucide="calendar"></i> ${escapeHtml(insight.date_formatted)}</div>
                    ${getActionButtons()}
                </div>
            </div>
        `;

        // 2. Render Article Body
        body.innerHTML = `
            <div class="content-width prose">
                <img src="${escapeHtml(insight.image_url || '/static/placeholder.png')}" 
                     alt="${escapeHtml(insight.title)}" class="feature-image" />
                ${insight.content}
                <hr class="divider">
                <div class="action-bar">${getActionButtons()}</div>
            </div>
        `;

        // 3. Render Sidebar Takeaways
        if (sidebarList) {
            const takeaways = Array.isArray(insight.takeaways) 
                ? insight.takeaways 
                : (insight.takeaways || "").split('\n').filter(t => t.trim() !== "");

            if (takeaways.length > 0) {
                sidebarList.innerHTML = takeaways.map(point => `
                    <li><i data-lucide="check-circle-2" class="takeaway-icon"></i> <span>${escapeHtml(point)}</span></li>
                `).join("");
            } else {
                const widget = sidebarList.closest('.sidebar-widget');
                if (widget) widget.style.display = 'none';
            }
        }

        // 4. Initialize Features
        initSaveFeature(insight);

        // 5. AdSense Injection
        initAdSense();
        const prose = body.querySelector('.prose');
        const paragraphs = prose?.querySelectorAll('p');
        if (paragraphs?.length >= 2) {
            const adContainer = document.createElement('div');
            adContainer.className = 'ad-container';
            paragraphs[1].after(adContainer);
            injectAdIntoContainer(adContainer, 'YOUR_SPECIFIC_SLOT_ID');
        }

        // 6. Initialize Icons
        if (window.lucide) lucide.createIcons();

    } catch (err) {
        console.error("Error loading article:", err);
        body.innerHTML = `<div class="content-width error-state">Failed to load article content.</div>`;
    }
}

/**
 * Fetches and renders related insights.
 */
export async function fetchRelatedInsights(slug) {
    const listContainer = document.getElementById("related-list");
    const header = document.getElementById("header_text");
    const section = listContainer?.closest('.related-articles');
    
    if (!listContainer) return;

    try {
        const related = await API.getRelatedInsights(slug);
        
        if (!related || related.length === 0) {
            if (section) section.style.display = 'none';
            return;
        }
        
        if (section) section.style.display = 'block';
        if (header) header.textContent = "Related Insights";

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

/**
 * Manages the "Save to Favorites" state in LocalStorage.
 */
export function initSaveFeature(insight) {
    const btnSaves = document.querySelectorAll('#btn-save');
    const getSavedSlugs = () => JSON.parse(localStorage.getItem('saved_insights') || '[]');

    const updateUI = () => {
        const saved = getSavedSlugs();
        const isSaved = saved.includes(insight.slug);
        
        btnSaves.forEach(btn => {
            btn.classList.toggle('active', isSaved);
            
            // Update short label
            const text = btn.querySelector('.btn-save');
            if (text) text.innerText = isSaved ? 'Saved' : 'Save';
            
            // Update full label (Sidebar/Desktop)
            const textFull = btn.querySelector('.btn-text');
            if (textFull) textFull.innerText = isSaved ? 'Saved to Favorites' : 'Save to Favorites';
        });
    };

    updateUI();

    btnSaves.forEach(btn => {
        btn.addEventListener('click', () => {
            let saved = getSavedSlugs();
            if (saved.includes(insight.slug)) {
                saved = saved.filter(s => s !== insight.slug);
            } else {
                saved.push(insight.slug);
            }
            localStorage.setItem('saved_insights', JSON.stringify(saved));
            updateUI();
        });
    });
}
