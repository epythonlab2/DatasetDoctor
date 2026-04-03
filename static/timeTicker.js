/**
 * TimeTicker Utility
 * Handles real-time relative timestamp updates (e.g., "15s ago").
 * This version operates purely on session memory and does not use localStorage.
 */

const TimeTicker = {
    /**
     * Calculates the relative time string between a given timestamp and now.
     * @param {string|Date} timestamp - The ISO string or Date object to compare.
     * @returns {string} - Human-readable relative time.
     */
    getRelativeTime(timestamp) {
        if (!timestamp) return "Just now";
        
        const now = new Date();
        const past = new Date(timestamp);
        const diffInSeconds = Math.floor((now - past) / 1000);

        // --- Seconds Logic ---
        if (diffInSeconds < 1) return "Just now";
        if (diffInSeconds < 60) return `${diffInSeconds}s ago`;
        
        // --- Minutes Logic ---
        if (diffInSeconds < 3600) {
            const mins = Math.floor(diffInSeconds / 60);
            return `${mins}m ago`;
        }

        // --- Hours Logic ---
        if (diffInSeconds < 86400) {
            const hours = Math.floor(diffInSeconds / 3600);
            return `${hours}h ago`;
        }
        
        // --- Fallback (Days/Weeks) ---
        return past.toLocaleDateString(undefined, { 
            month: 'short', 
            day: 'numeric' 
        });
    },

    /**
     * Syncs the DOM element with the latest relative time.
     * Uses a data-attribute 'timestamp' as the source of truth.
     */
    refresh() {
        const timeLabel = document.getElementById('scan-time-label');
        
        if (timeLabel && timeLabel.dataset.timestamp) {
            const relativeString = this.getRelativeTime(timeLabel.dataset.timestamp);
            
            // Performance: Only update the DOM if the text has actually changed
            if (timeLabel.textContent !== relativeString) {
                timeLabel.textContent = relativeString;
            }
        }
    },

    /**
     * Initializes the ticker loop.
     * Runs every 1000ms to ensure the "seconds" display stays accurate.
     */
    init() {
        const timeLabel = document.getElementById('scan-time-label');
        
        // If the element isn't on the current page, exit silently
        if (!timeLabel) return;

        // Perform initial render
        this.refresh();

        // Establish the "Live" update loop
        setInterval(() => this.refresh(), 1000);
    }
};

/**
 * Bootstraps the ticker once the DOM is fully loaded.
 */
document.addEventListener('DOMContentLoaded', () => TimeTicker.init());
