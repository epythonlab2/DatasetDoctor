/**
 * API Module
 * Centralized interface for all backend communication.
 * All requests are automatically protected with X-Client-ID and include retry logic.
 */

import { getOrCreateClientId } from './utils/identity.js';

const BASE_URL = '/api/v1';

/**
 * Ensures a valid client identity exists before making requests.
 */
function safeClientId() {
    const id = getOrCreateClientId();
    if (!id || id === "null" || id === "undefined") {
        throw new Error("[CRITICAL] Client identity missing.");
    }
    return id;
}

/**
 * Builds a full URL from a relative path.
 */
const getUrl = (path) => `${window.location.origin}${path.startsWith('/') ? '' : '/'}${path}`;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export const API = {
    getUrl,

    /**
     * Core Request Handler: Unified logic for all network requests.
     */
    async fetchWithRetry(url, options = {}, retries = 3) {
        const headers = {
            "Content-Type": "application/json",
            "X-Client-ID": safeClientId(),
            ...(options.headers || {})
        };

        for (let i = 0; i < retries; i++) {
            try {
                const res = await fetch(url, { ...options, headers, credentials: "same-origin" });

                if (res.status === 425) return null; // Server not ready
                if ((res.status === 404 || res.status === 504) && i < retries - 1) {
                    await sleep(500 * (i + 1));
                    continue;
                }

                if (!res.ok) {
                    const err = await res.json().catch(() => ({ detail: `Error ${res.status}` }));
                    throw new Error(err.detail || "Server Error");
                }

                return await res.json();
            } catch (err) {
                if (i === retries - 1) throw err;
                await sleep(300);
            }
        }
    },

    /* ---------- Upload (XHR for progress tracking) ---------- */

    async uploadFile(file, onProgress) {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            const formData = new FormData();
            formData.append("file", file);

            xhr.upload.onprogress = (e) => {
                if (e.lengthComputable && onProgress) {
                    onProgress(Math.round((e.loaded / e.total) * 100));
                }
            };

            xhr.onload = () => {
                if (xhr.status === 200) resolve(JSON.parse(xhr.responseText));
                else reject(new Error(`Upload failed: ${xhr.status}`));
            };

            xhr.onerror = () => reject(new Error("Network error during upload."));
            xhr.open("POST", getUrl("/upload"));
            xhr.setRequestHeader("X-Client-ID", safeClientId());
            xhr.send(formData);
        });
    },

    /* ---------- Data Retrieval & Actions ---------- */

    async fetchAnalysis(id) { return this.fetchWithRetry(getUrl(`/analysis/${id}`)); },
    
    async fetchMeta(id) { return this.fetchWithRetry(getUrl(`/get_meta/${encodeURIComponent(id)}`)); },
    
    async fetchPreview(id) {
        localStorage.setItem("dataset_id", id);
        return this.fetchWithRetry(getUrl(`${BASE_URL}/preview/${encodeURIComponent(id)}`));
    },

    async setTarget(id, target) {
        return this.fetchWithRetry(getUrl(`/set-target/${encodeURIComponent(id)}`), {
            method: "POST",
            body: JSON.stringify({ target })
        });
    },

    async cleanDataset(id, payload = { action: 'remove_duplicates' }) {
        return this.fetchWithRetry(getUrl(`/clean/${id}`), {
            method: "POST",
            body: JSON.stringify(payload)
        });
    },

    async reset(datasetId) {
        return this.fetchWithRetry(getUrl(`/reset/${encodeURIComponent(datasetId)}`), { method: "POST" });
    },

    /* ---------- Audit & Insights ---------- */

    async fetchAuditLogs(limit = 100) {
        return this.fetchWithRetry(getUrl(`/audit/logs?limit=${limit}`));
    },

    async getInsights() {
        return this.fetchWithRetry(getUrl(`${BASE_URL}/insights`));
    },

    async getRelatedInsights(slug) {
        return this.fetchWithRetry(getUrl(`${BASE_URL}/insights/${slug}/related`));
    },

    async getArticle(slug) {
        return this.fetchWithRetry(getUrl(`${BASE_URL}/data/insights/${slug}`));
    },

    async verifyExport(id) {
        const response = await fetch(getUrl(`/export/${encodeURIComponent(id)}`));
        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            const e = new Error(err.detail || "Export verification failed");
            e.status = response.status;
            throw e;
        }
        return response;
    }
};
