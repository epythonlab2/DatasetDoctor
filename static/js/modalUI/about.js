export const About = {
    _cache: null,

    init() {
        const modal = document.getElementById('aboutModal');
        if (!modal) return;

        // Close when clicking outside content
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.close();
            }
        });

        // ESC key support
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modal.classList.contains('active')) {
                this.close();
            }
        });

        // Optional preload
        //this._preload();
    },

    async _preload() {
        try {
            const res = await fetch('/about-fragment'); // Use the FastAPI route
            if (res.ok) {
                this._cache = await res.text();
            }
        } catch (err) {
            console.warn("Preload failed", err);
        }
    },

    async show() {
        const modal = document.getElementById('aboutModal');
        const placeholder = document.getElementById('about-content-placeholder');

        if (!modal || !placeholder) return;

        // Prevent layout shift
        const scrollBarWidth = window.innerWidth - document.documentElement.clientWidth;
        document.body.style.paddingRight = scrollBarWidth + 'px';

        modal.classList.add('active');
        document.body.style.overflow = 'hidden';

        // Loading state
        placeholder.innerHTML = `
            <div class="text-center p-5">
                <div class="spinner-border text-secondary mb-3"></div>
                <p class="text-muted small">Loading briefing...</p>
            </div>
        `;

        try {
            if (!this._cache) {
                const response = await fetch('/about-fragment'); // Match FastAPI route
                if (!response.ok) throw new Error('About fragment not found');
                this._cache = await response.text();
            }

            placeholder.innerHTML = this._cache;

            if (window.lucide) {
                window.lucide.createIcons();
            }

        } catch (error) {
            console.error("About Load Error:", error);
            placeholder.innerHTML = `
                <div class="text-center p-5">
                    <i data-lucide="alert-circle" class="text-danger mb-3" style="width:40px;"></i>
                    <h5 class="fw-bold">Connection Interrupted</h5>
                    <p class="text-muted small">The Intelligence Briefing could not be retrieved.</p>
                    <button class="btn btn-sm btn-outline-secondary mt-3" onclick="About.close()">Dismiss</button>
                </div>
            `;
            if (window.lucide) window.lucide.createIcons();
        }
    },

    close() {
        const modal = document.getElementById('aboutModal');
        if (modal) {
            modal.classList.remove('active');
            document.body.style.overflow = 'auto';
            document.body.style.paddingRight = '';
        }
    }
};

// Expose to window immediately for the HTML onclick handlers
window.About = About;

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => About.init());
} else {
    About.init();
}
