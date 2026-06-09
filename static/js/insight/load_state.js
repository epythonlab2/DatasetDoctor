/**
 * Global Loader System
 * Supports smooth transitions and progress tracking
 */

let loaderEl = null;
let progressBarEl = null;

export function initLoader(selector = "#fullscreen-loader") {
    loaderEl = document.querySelector(selector);
    progressBarEl = document.getElementById("loader-progress-bar");
}

export function showLoader(message = null) {
    if (!loaderEl) return;
    
    // Reset bar
    if (progressBarEl) progressBarEl.style.width = "0%";
    
    loaderEl.classList.remove("hidden");
    loaderEl.style.opacity = "1";
}

export function hideLoader() {
    if (!loaderEl) return;

    // 1. Set progress to 100% so it looks finished
    if (progressBarEl) progressBarEl.style.width = "100%";

    // 2. Add the 'hidden' class to trigger the CSS transition
    // pointer-events: none will now be applied via CSS
    loaderEl.classList.add("hidden");
    loaderEl.style.opacity = "0";
}

export function updateLoaderProgress(percent) {
    if (progressBarEl) {
        progressBarEl.style.width = `${Math.min(percent, 100)}%`;
    }
}

export function withLoader(promise, message = "Loading...") {
    showLoader(message);
    
    // Simulate initial progress to show it's working
    updateLoaderProgress(40); 

    return Promise.resolve(promise)
        .then((res) => {
            updateLoaderProgress(100);
            setTimeout(hideLoader, 300); // Small delay to show 100%
            return res;
        })
        .catch((err) => {
            hideLoader();
            throw err;
        });
}

// ---------------- UI HELPERS ----------------



export function initScrollProgress() {
    const bar = document.getElementById("progress-bar");
    if (!bar) return;

    let ticking = false;

    window.addEventListener("scroll", () => {
        if (!ticking) {
            window.requestAnimationFrame(() => {
                const max = document.documentElement.scrollHeight - window.innerHeight;
                const percent = (window.scrollY / max) * 100;
                bar.style.width = `${percent}%`;
                ticking = false;
            });
            ticking = true;
        }
    });
}
export function showErrorState(message = "Please refresh the page and try again.") {
    const grid = document.getElementById("insightsGrid");
    if (!grid) return;
    
    grid.innerHTML = `
        <div style="text-align:center;padding:3rem;color:var(--text-muted)">
            <i data-lucide="alert-circle" size="48" style="margin-bottom:1rem"></i>
            <h3>Failed to load insights</h3>
            <p>${message}</p>
        </div>
    `;
    // Re-initialize icons if you use them in the error state
    if (typeof lucide !== 'undefined') lucide.createIcons();
}
