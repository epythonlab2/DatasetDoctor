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

// Launch buttons
const openUploader = () => {
    window.location.href = "/uploader";
};

document.getElementById("launch-engine-btn")?.addEventListener("click", openUploader);
document.getElementById("hero-launch-btn")?.addEventListener("click", openUploader);

// Lucide (self-hosted)
lucide.createIcons();
