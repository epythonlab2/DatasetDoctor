const getUrl = (path) => {
    const origin = window.location.origin;
    return origin + (path.startsWith('/') ? '' : '/') + path;
};

// Helper for waiting between retries
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export const API = {
    getUrl,

    /**
     * Enhanced Fetch with Instance Recovery
     * Specifically designed to handle 404s caused by multi-instance cloud deployments.
     */
    async fetchWithRetry(url, options = {}, retries = 5) {
        for (let i = 0; i < retries; i++) {
            const res = await fetch(url, options);
            
            // If it's a 404, we might be hitting the 'wrong' cloud instance.
            // We retry to 'roll the dice' again with the load balancer.
            if (res.status === 404 && i < retries - 1) {
                console.warn(`[RETRYING] Instance mismatch (404) at ${url}. Attempt ${i + 1}`);
                await sleep(300); // Small delay to let the load balancer switch
                continue;
            }
            
            if (!res.ok) throw new Error(`API Error: ${res.status}`);
            return res.json();
        }
    },

    async fetchAnalysis(id) {
        return this.fetchWithRetry(getUrl(`/analysis/${id}`));
    },

    async fetchMeta(id) {
        // Using get_meta which you defined in your FastAPI routes
        return this.fetchWithRetry(getUrl(`/get_meta/${id}`));
    },

    async cleanDataset(id, payload = { action: 'remove_duplicates' }) {
        // POSTs are less likely to need retries because they 'create' state, 
        // but we'll use a standard try/catch for safety.
        try {
            const res = await fetch(getUrl(`/clean/${id}`), { 
                method: "POST",
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            if (!res.ok) {
                const errorData = await res.json().catch(() => ({ 
                    detail: "The cleaning engine encountered a startup error." 
                }));
                throw new Error(errorData.detail);
            }

            const text = await res.text();
            return text ? JSON.parse(text) : { status: "processing", stage: "initializing" };

        } catch (error) {
            console.error(`[API ERROR] cleanDataset(${id}):`, error);
            throw error;
        }
    },

    async reset() {
        const res = await fetch(getUrl("/reset"), { method: "POST" });
        if (!res.ok) throw new Error("Reset failed");
        return res.json();
    }
};
