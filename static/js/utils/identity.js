// static/js/utils/identity.js

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

        // Fire-and-forget (no dependency on API module → avoids circular import)
        try {
            fetch('/api/v3/system/ping', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Client-ID': clientId
                },
                body: JSON.stringify({ event: "NEW_USER_CREATED" }),
                credentials: "same-origin"
            }).catch(() => {});
        } catch (_) {}
    }

    cachedClientId = clientId;
    return clientId;
};
