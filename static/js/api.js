/**
 * API Module
 * Handles all network communication with the FastAPI backend.
 */

const getUrl = (path) => {
    const origin = window.location.origin;
    return origin + (path.startsWith('/') ? '' : '/') + path;
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export const API = {
    getUrl,

    /* ---------- Core Network Logic ---------- */

    async fetchWithRetry(url, options = {}, retries = 5) {
        for (let i = 0; i < retries; i++) {
            const res = await fetch(url, options);
            
            if (res.status === 404 && i < retries - 1) {
                console.warn(`[RETRYING] Instance mismatch (404) at ${url}. Attempt ${i + 1}`);
                await sleep(300);
                continue;
            }
            
            if (!res.ok) {
                const errBody = await res.json().catch(() => ({ detail: `Error ${res.status}` }));
                throw new Error(errBody.detail || `Server Error: ${res.status}`);
            }
            return res.json();
        }
    },

    /* ---------- Data Retrieval ---------- */

    async fetchAnalysis(id) {
        return this.fetchWithRetry(getUrl(`/analysis/${id}`));
    },

    async fetchMeta(id) {
        return this.fetchWithRetry(getUrl(`/get_meta/${id}`));
    },

    async fetchPreview(id) {
        return this.fetchWithRetry(getUrl(`/preview/${encodeURIComponent(id)}`));
    },

    /* ---------- Data Actions ---------- */

    async setTarget(id, target) {
        return this.fetchWithRetry(getUrl(`/set-target/${encodeURIComponent(id)}`), {
            method: "POST",
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ target })
        });
    },

    async cleanDataset(id, payload = { action: 'remove_duplicates' }) {
        try {
            const res = await fetch(getUrl(`/clean/${id}`), { 
                method: "POST",
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            if (!res.ok) {
                const errorData = await res.json().catch(() => ({ 
                    detail: "The cleaning engine encountered an error." 
                }));
                throw new Error(errorData.detail);
            }

            const text = await res.text();
            return text ? JSON.parse(text) : { status: "processing" };
        } catch (error) {
            console.error(`[API ERROR] cleanDataset:`, error);
            throw error;
        }
    },

    /* ---------- Export Logic ---------- */

    /**
     * Checks if a clean file exists before allowing the download.
     */
    async verifyExport(id) {
        const res = await fetch(getUrl(`/export/${encodeURIComponent(id)}`), { method: 'GET' });
        if (!res.ok) {
            const err = await res.json().catch(() => ({ detail: "Clean data not found." }));
            throw new Error(err.detail);
        }
        return true; 
    },

    /* ---------- System ---------- */

    async reset() {
        const res = await fetch(getUrl("/reset"), { method: "POST" });
        if (!res.ok) throw new Error("Reset failed");
        return res.json();
    }
};
