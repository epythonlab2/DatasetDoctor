// src/utils/ads.js

export function initAdSense() {
    // Only load the script once
    if (document.querySelector('script[src*="adsbygoogle"]')) return;

    const script = document.createElement('script');
    script.src = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js";
    script.async = true;
    script.crossOrigin = "anonymous";
    document.head.appendChild(script);
}

export function injectAdIntoContainer(container, slotId) {
    const ins = document.createElement('ins');
    ins.className = 'adsbygoogle';
    ins.style.display = 'block';
    ins.setAttribute('data-ad-client', 'ca-pub-YOUR_PUBLISHER_ID'); // Replace with your ID
    ins.setAttribute('data-ad-slot', slotId);
    ins.setAttribute('data-ad-format', 'auto');
    ins.setAttribute('data-full-width-responsive', 'true');

    container.appendChild(ins);
    
    // Push the ad to AdSense
    try {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (e) {
        console.error("AdSense push error:", e);
    }
}
