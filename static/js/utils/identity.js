// static/js/utils/identity.js

let cachedClientId = null;

export const getOrCreateClientId = () => {
    // Fast path (memory cache)
    if (cachedClientId) return cachedClientId;

    let clientId = localStorage.getItem('ds_doctor_client_id');

    if (!clientId) {
        clientId = crypto.randomUUID();
        localStorage.setItem('ds_doctor_client_id', clientId);

        console.log("🆕 New Client ID Generated:", clientId);

        const url = '/api/v3/system/ping';
        const payload = JSON.stringify({ 
            event: "NEW_USER_CREATED",
            clientId: clientId // Passed inside body since sendBeacon doesn't support custom headers
        });

        // Use sendBeacon to avoid chaining critical requests in Lighthouse
        if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
            const blob = new Blob([payload], { type: 'application/json' });
            navigator.sendBeacon(url, blob);
        } else {
            // Fallback for older/non-standard environments
            try {
                fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: payload,
                    credentials: 'same-origin',
                    priority: 'low'
                }).catch(() => {});
            } catch (_) {}
        }
    }

    cachedClientId = clientId;
    return clientId;
};
