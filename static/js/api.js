/**
 * API Module (CSP-safe + Deterministic Identity Injection)
 */

import { getOrCreateClientId } from './utils/identity.js';

/* ---------- URL Builder ---------- */

const getUrl = (path) => {
    const origin = window.location.origin;
    return origin + (path.startsWith('/') ? '' : '/') + path;
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/* ---------- Identity Guard ---------- */

function safeClientId() {
    const id = getOrCreateClientId();

    console.log("[IDENTITY] Client ID:", id);

    if (!id || id === "null" || id === "undefined") {
        throw new Error("[CRITICAL] Client identity missing or invalid.");
    }

    return id;
}

/* ---------- Core API ---------- */

export const API = {

    getUrl,

    /* ---------- Core Request Handler ---------- */

    async fetchWithRetry(url, options = {}, retries = 5) {

        // Ensure headers object exists FIRST
        const headers = {
            ...(options.headers || {}),
            "X-Client-ID": safeClientId()   // ✅ ALWAYS wins
        };

        for (let i = 0; i < retries; i++) {
            try {

                console.log("[API REQUEST]", {
                    url,
                    method: options.method || "GET",
                    headers
                });

                const res = await fetch(url, {
                    ...options,                  // ✅ spread first
                    headers,                    // ✅ enforce headers AFTER
                    credentials: "same-origin"  // ✅ attach cookies if needed
                });

                if (res.status === 404 && i < retries - 1) {
                    console.warn(`[RETRY] ${url} (attempt ${i + 1})`);
                    await sleep(300);
                    continue;
                }

                if (!res.ok) {
                    const errBody = await res.json().catch(() => ({
                        detail: `Error ${res.status}`
                    }));
                    throw new Error(errBody.detail || `Server Error: ${res.status}`);
                }

                const text = await res.text();
                return text ? JSON.parse(text) : {};

            } catch (err) {

                if (i === retries - 1) {
                    console.error("[API ERROR FINAL]", err);
                    throw err;
                }

                console.warn("[API RETRYING]", err.message);
                await sleep(200);
            }
        }
    },

    /* ---------- Upload (XHR for progress) ---------- */

    uploadFile(file, onProgress) {
        return new Promise((resolve, reject) => {

            const xhr = new XMLHttpRequest();
            const formData = new FormData();
            formData.append("file", file);

            xhr.upload.onprogress = (e) => {
                if (e.lengthComputable && onProgress) {
                    const percent = Math.round((e.loaded / e.total) * 100);
                    onProgress(percent);
                }
            };

            xhr.onload = () => {
                if (xhr.status === 200) {
                    try {
                        resolve(JSON.parse(xhr.responseText));
                    } catch {
                        reject(new Error("Malformed server response."));
                    }
                } else {
                    reject(new Error(`Upload failed: ${xhr.status}`));
                }
            };

            xhr.onerror = () => reject(new Error("Network error during upload."));

            xhr.open("POST", getUrl("/upload"));

            // ✅ Inject identity consistently
            xhr.setRequestHeader("X-Client-ID", safeClientId());

            xhr.send(formData);
        });
    },

    /* ---------- Data Retrieval ---------- */

    async fetchAnalysis(id) {
        localStorage.setItem("dataset_id", id);
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
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ target })
        });
    },

    async cleanDataset(id, payload = { action: 'remove_duplicates' }) {
        return this.fetchWithRetry(getUrl(`/clean/${id}`), {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });
    },

    /* ---------- Export ---------- */

    async verifyExport(id) {
        return this.fetchWithRetry(getUrl(`/export/${encodeURIComponent(id)}`), {
            method: "GET"
        });
    },

    /* ---------- System ---------- */

    async reset(datasetId) {
        return this.fetchWithRetry(getUrl(`/reset/${encodeURIComponent(datasetId)}`), {
            method: "POST"
        });
    },
    
    /* ---------- System Audit ---------- */

    /**
     * Fetches system audit logs from the backend.
     * @param {number} limit - Number of logs to retrieve.
     */
    async fetchAuditLogs(limit = 100) {
        // Use a relative path from the root or absolute to be safe in cloud
        const url = `/audit/logs?limit=${limit}`;
        
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'x-client-id': localStorage.getItem('ds_doctor_client_id') || 'anonymous',
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`Server responded with ${response.status}`);
        }

        return await response.json();
    },
};


