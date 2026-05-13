/**
 * Entry Point: Dataset Analysis Dashboard
 * Coordinates state initialization and starts the Controller lifecycle.
 */
import { initNavigationGuard } from './utils/navigationGuard.js';
import { state } from "./utils/state.js";
import { Controller } from "./ui/controller.js";
import { Table } from "./ui/table.js";
import { Actions } from "./ui/actions.js";

// Initialize the navigation guard immediately
initNavigationGuard();

/**
 * Extracts the Dataset UUID from the URL path.
 */
function getDatasetId() {
    const parts = window.location.pathname.split("/");
    let id = parts[parts.length - 1];

    if (!id || id === "dashboard" || id.includes("blob:")) {
        id = "preview-dataset";
    }
    return id;
}

/**
 * Initialization: Runs when the DOM is fully loaded.
 */
document.addEventListener("DOMContentLoaded", () => {
    // 1. Initial icon render
    lucide.createIcons();
    
    

    // 2. Set UI to loading state
    //UI.setLoadingState(); 

    // 2. Initialize State
    state.datasetId = getDatasetId();

    // 3. THE FIX: Kick off the architecture chain.
    // This calls Controller -> Service -> Presenter -> UI
    Controller.loadData(); 
});

/**
 * Sidebar Toggle Logic (Mobile)
 */
function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) {
        const isActive = sidebar.classList.toggle('active');
        const toggleIcon = document.querySelector('.mobile-toggle i');
        if (toggleIcon) {
            const iconName = isActive ? 'x' : 'menu';
            toggleIcon.setAttribute('data-lucide', iconName);
            lucide.createIcons();
        }
    }
}

/**
 * Click Outside Handler (Mobile Sidebar)
 */
document.addEventListener('click', (e) => {
    const sidebar = document.querySelector('.sidebar');
    const toggle = document.querySelector('.mobile-toggle');
    
    if (window.innerWidth <= 1024 && sidebar?.classList.contains('active')) {
        if (!sidebar.contains(e.target) && !toggle.contains(e.target)) {
            sidebar.classList.remove('active');
            const toggleIcon = document.querySelector('.mobile-toggle i');
            if (toggleIcon) {
                toggleIcon.setAttribute('data-lucide', 'menu');
                lucide.createIcons();
            }
        }
    }
});

/**
 * Global Exports
 */
window.switchTableTab = Table.switch;
window.exportDataset = Actions.export;
window.toggleSidebar = toggleSidebar;

window.resetAnalysis = async () => {
    try {
        await Actions.reset();
    } catch (err) {
        console.error("Global Reset Handler Error:", err);
        window.location.href = "/";
    }
};
