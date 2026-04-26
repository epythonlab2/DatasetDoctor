/**
 * DatasetDoctor Audit UI - Geo-Enabled
 * Retrieves logs and maps environment.geo data to the table.
 */

import { API } from "../api.js";

const formatTimestamp = (iso) => {
    if (!iso) return "-";
    return new Date(iso).toLocaleString('en-GB', { 
        dateStyle: 'short', 
        timeStyle: 'medium' 
    });
};

export async function loadAuditLogs() {
    const tableBody = document.querySelector("#audit-table tbody");
    if (!tableBody) return;

    try {
        const logs = await API.fetchAuditLogs(100);

        if (!logs || logs.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="8" class="text-center">No activity found.</td></tr>`;
            return;
        }

        tableBody.innerHTML = logs.map(log => {
            // Mapping Logic
            const time = formatTimestamp(log.timestamp);
            const user = log.actor?.user_id || "anonymous";
            const action = typeof log.action === 'object' ? log.action.slug : log.action;
            const entity = log.action?.entity || log.dataset_id || "-";
            
            // Geographic Mapping
            const country = log.environment?.geo?.country || "Local";
            const city = log.environment?.geo?.city || "Host";
            const ip = log.environment?.ip || "127.0.0.1";
            
            return `
                <tr>
                    <td><small>${time}</small></td>
                    <td><code class="user-id">${user}</code></td>
                    <td><span class="badge-action">${action}</span></td>
                    <td>${entity}</td>
                    <td><strong>${city}, ${country}</strong></td>
                    <td>${ip}</td>
                </tr>
            `;
        }).join("");

    } catch (err) {
        console.error("Audit UI Failure:", err);
        tableBody.innerHTML = `<tr><td colspan="8" class="error-text">Failed to sync logs.</td></tr>`;
    }
}

loadAuditLogs();
