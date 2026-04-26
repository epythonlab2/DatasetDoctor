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

        if (!logs || !Array.isArray(logs) || logs.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="6" class="text-center">No activity found.</td></tr>`;
            return;
        }

        tableBody.innerHTML = logs.map(log => {
            const time = formatTimestamp(log.timestamp);
            const user = log.actor?.user_id || "anonymous";
            const action = typeof log.action === 'object' ? log.action.slug : log.action;
            const entity = log.action?.entity || log.dataset_id || "-";
            
            const country = log.environment?.geo?.country || "Cloud";
            const city = log.environment?.geo?.city || "Remote";
            const ip = log.environment?.ip || "0.0.0.0";
            
            return `
                <tr>
                    <td><small>${time}</small></td>
                    <td><code class="user-id" title="${user}">${user.substring(0,8)}...</code></td>
                    <td><span class="badge-action">${action}</span></td>
                    <td><small>${entity}</small></td>
                    <td><strong>${city}, ${country}</strong></td>
                    <td>${ip}</td>
                </tr>
            `;
        }).join("");

    } catch (err) {
        // This is crucial for cloud debugging
        console.error("DEBUG: Audit Sync Error:", err); 
        tableBody.innerHTML = `<tr><td colspan="6" class="error-text" style="color:red; text-align:center;">Failed to sync logs. Check console.</td></tr>`;
    }
}

// Ensure the DOM is ready before running
window.addEventListener('DOMContentLoaded', loadAuditLogs);
