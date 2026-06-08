// static/js/insight_detail.js

/**
 * Fetches the main article content and renders it.
 */
export async function loadArticleDetail(slug) {
    try {
        const response = await fetch(`/api/v1/insights/${slug}`);
        if (!response.ok) throw new Error("Failed to fetch article");
        
        const insight = await response.json();

        document.getElementById("article-hero").innerHTML = `
            <div class="content-width">
                <span class="category-badge">${insight.category}</span>
                <h1 class="article-title">${insight.title}</h1>
                <div class="article-meta">
                    <div class="meta-item"><i data-lucide="user"></i> Epython Lab</div>
                    <div class="meta-item"><i data-lucide="calendar"></i> ${insight.date_formatted}</div>
                    <div class="meta-item"><i data-lucide="clock"></i> 10 min read</div>
                </div>
            </div>
        `;

        document.getElementById("article-body").innerHTML = `
            <div class="content-width prose">
                <img src="${insight.image_url}" alt="${insight.title}" class="feature-image" />
                ${insight.content}
            </div>
        `;

        lucide.createIcons();
    } catch (err) {
        console.error("Error loading article:", err);
    }
}

/**
 * Fetches and renders related insights grid.
 */
export async function fetchRelatedInsights(slug) {
    const grid = document.getElementById("related-grid");
    try {
        const response = await fetch(`/api/v1/insights/${slug}/related`);
        const related = await response.json();
        
        if (!related.length) {
            grid.innerHTML = "<p>No related insights available.</p>";
            return;
        }

        grid.innerHTML = related.map(item => `
            <article class="related-card">
                <span class="category-badge">${item.category}</span>
                <h3>${item.title}</h3>
                <p>${item.content.replace(/<[^>]*>?/gm, '').substring(0, 100)}...</p>
                <a href="/insights/${item.slug}">Read more &rarr;</a>
            </article>
        `).join("");
    } catch (err) {
        grid.innerHTML = "<p>Could not load related insights.</p>";
    }
}
