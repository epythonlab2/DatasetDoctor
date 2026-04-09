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
     * Returns a 202 Accepted status immediately.
     */
    async cleanDataset(id) {
	    // ADD the method: "POST" here!
	    const res = await fetch(getUrl(`/clean/${id}`), { 
		method: "POST",
		headers: {
		    'Content-Type': 'application/json'
		}
	    });
	    
	    if (!res.ok) {
		const errorData = await res.json().catch(() => ({ detail: "Unknown Server Error" }));
		throw new Error(errorData.detail);
	    }

	    const text = await res.text();
	    return text ? JSON.parse(text) : { status: "processing" };
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
