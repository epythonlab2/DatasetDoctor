// Navigation
document.querySelectorAll(".nav-scroll").forEach(btn => {
    btn.addEventListener("click", () => {
        const target = btn.dataset.target;
        const el = document.getElementById(target);
        if (el) el.scrollIntoView({ behavior: "smooth" });
    });
});

// Home redirect
document.querySelector(".nav-home")?.addEventListener("click", () => {
    window.location.href = "/";
});

/**
 * @function openUploader
 * @description Launches the DatasetDoctor engine in a new browser tab.
 * Uses '_blank' to maintain the landing page state in the original tab.
 */
const openUploader = () => {
    // SECURITY NOTE: '_blank' opens in new tab
    window.open("/uploader", "_blank");
};

// Event Listeners for Launch Actions
document.getElementById("launch-engine-btn")?.addEventListener("click", openUploader);
document.getElementById("hero-launch-btn")?.addEventListener("click", openUploader);

// Initialize Lucide Icons
lucide.createIcons();
