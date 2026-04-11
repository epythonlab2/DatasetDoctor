const getUrl = (path) => {
    const origin = window.location.origin;
    return origin + (path.startsWith('/') ? '' : '/') + path;
};

export const API = {
    getUrl,

    /**
     * Fetches the full analysis results.
     * Used primarily when status is 'ready'.
     */
    async fetchAnalysis(id) {
        const res = await fetch(getUrl(`/analysis/${id}`));
        if (!res.ok) throw new Error("Failed to fetch analysis");
        return res.json();
    },

    /**
     * Polling Endpoint: Fetches the current metadata/status of the dataset.
     * Essential for tracking background cleaning progress.
     */
    async fetchMeta(id) {
        const res = await fetch(getUrl(`/get_meta/${id}`));
        if (!res.ok) throw new Error("Failed to fetch metadata");
        return res.json();
    },

    /**
     * Triggers the Background Cleaning Pipeline.
     * This is a multi-purpose endpoint that sends cleaning instructions to the worker.
     * * @param {string} id - The unique Dataset UUID.
     * @param {Object} [payload={ action: 'deduplicate' }] - The cleaning operation details.
     * @returns {Promise<Object>} The server response or a default processing state.
     * @throws {Error} If the server rejects the request or the pipeline fails to start.
     */
    async cleanDataset(id, payload = { action: 'remove_duplicates' }) {
        try {
            const res = await fetch(getUrl(`/clean/${id}`), { 
                method: "POST",
                headers: {
                    'Content-Type': 'application/json'
                },
                // Crucial: Converts the JS object into a JSON string for the FastAPI backend
                body: JSON.stringify(payload)
            });
            
            // Handle non-2xx status codes
            if (!res.ok) {
                // Try to parse the specific error message from the backend (e.g., FastAPI's 'detail')
                const errorData = await res.json().catch(() => ({ 
                    detail: "The cleaning engine encountered a startup error." 
                }));
                throw new Error(errorData.detail);
            }

            // Parse response body if it exists, otherwise provide a fallback status
            const text = await res.text();
            return text ? JSON.parse(text) : { status: "processing", stage: "initializing" };

        } catch (error) {
            console.error(`[API ERROR] cleanDataset(${id}):`, error);
            // Re-throw so the UI (Actions.Dedupe) can catch it and show an alert
            throw error;
        }
    },
    /**
     * Resets the environment (System-wide).
     */
    async reset() {
        const res = await fetch(getUrl("/reset"), { method: "POST" });
        if (!res.ok) throw new Error("Reset failed");
        return res.json();
    }
};
