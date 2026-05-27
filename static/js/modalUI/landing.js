// Navigation
document.addEventListener("DOMContentLoaded", () => {

    // Navigation
    document.querySelectorAll(".nav-scroll").forEach(btn => {
        btn.addEventListener("click", () => {
            const target = btn.dataset.target;
            const el = document.getElementById(target);

            if (el) {
                el.scrollIntoView({
                    behavior: "smooth"
                });
            }
        });
    });

    // Home redirect
    document.querySelector(".nav-home")?.addEventListener("click", () => {
        window.location.href = "/";
    });

    /**
     * Launch DatasetDoctor uploader
     */
    const openUploader = () => {
        window.open("/uploader", "_blank");
    };

    // Launch actions
    document.getElementById("launch-engine-btn")
        ?.addEventListener("click", openUploader);

    document.getElementById("hero-launch-btn")
        ?.addEventListener("click", openUploader);

    // Safe Lucide initialization
    if (window.lucide) {
        lucide.createIcons();
    } else {
        console.error("Lucide library failed to load.");
    }

});
