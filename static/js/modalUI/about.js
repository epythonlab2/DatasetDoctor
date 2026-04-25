/**
 * @module About
 * @description Manages the Intelligence Briefing modal, including asynchronous content 
 * fetching, caching, UI state management, and event handling for DatasetDoctor.
 */
export const About = {
    /** * @private
     * @type {string|null} Stores the fetched HTML fragment to prevent redundant network requests.
     */
    _cache: null,

    /**
     * @function init
     * @description Initializes core event listeners for the modal. Sets up click-to-dismiss 
     * on the backdrop and global escape key handling.
     * @returns {void}
     */
    init() {
        const modal = document.getElementById('aboutModal');
        if (!modal) return;

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.close();
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modal.classList.contains('active')) {
                this.close();
            }
        });
    },

    /**
     * @async
     * @function show
     * @description Displays the "About" modal. Implements body-scroll locking (with layout 
     * shift compensation), displays a loading state, and fetches content from the 
     * `/about-fragment` endpoint if not already cached.
     * @throws {Error} Logs and displays a UI error state if the network request fails.
     * @returns {Promise<void>}
     */
    async show() {
        const modal = document.getElementById('aboutModal');
        const placeholder = document.getElementById('about-content-placeholder');

        if (!modal || !placeholder) return;

        // Prevent layout jump by calculating scrollbar width
        const scrollBarWidth = window.innerWidth - document.documentElement.clientWidth;
        document.body.style.paddingRight = scrollBarWidth + 'px';

        modal.classList.add('active');
        document.body.style.overflow = 'hidden';

        placeholder.innerHTML = `
            <div class="text-center p-5">
                <div class="spinner-border text-secondary mb-3"></div>
                <p class="text-muted small">Loading briefing...</p>
            </div>
        `;

        try {
            if (!this._cache) {
                const response = await fetch('/about-fragment');
                if (!response.ok) throw new Error('About fragment not found');
                this._cache = await response.text();
            }

            placeholder.innerHTML = this._cache;

            // Re-initialize icons for dynamically injected content
            if (window.lucide) {
                window.lucide.createIcons();
            }

        } catch (error) {
            console.error("About Load Error:", error);

            placeholder.innerHTML = `
                <div class="text-center p-5">
                    <i data-lucide="alert-circle" class="text-danger mb-3 icon-lg"></i>
                    <h5 class="fw-bold">Connection Interrupted</h5>
                    <p class="text-muted small">The Intelligence Briefing could not be retrieved.</p>
                    <button class="btn btn-sm btn-outline-secondary mt-3" id="about-dismiss-btn">Dismiss</button>
                </div>
            `;

            const btn = document.getElementById('about-dismiss-btn');
            if (btn) {
                btn.addEventListener('click', () => this.close());
            }

            if (window.lucide) window.lucide.createIcons();
        }
    },

    /**
     * @function close
     * @description Dismisses the modal and restores default document scrolling 
     * and padding properties.
     * @returns {void}
     */
    close() {
        const modal = document.getElementById('aboutModal');
        if (modal) {
            modal.classList.remove('active');
            document.body.style.overflow = 'auto';
            document.body.style.paddingRight = '';
        }
    }
};

window.About = About;

document.addEventListener('DOMContentLoaded', () => About.init());
