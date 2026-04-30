/**
 * Entry Point: Dataset Analysis Dashboard
 * Coordinates the polling logic, state initialization, and UI distribution.
 */
import { initNavigationGuard } from './utils/navigationGuard.js';


import { state } from "./utils/state.js";
import { Controller } from "./ui/controller.js";
import { UI } from "./ui/ui.js";
import { Table } from "./ui/table.js";
import { Actions } from "./ui/actions.js";

/**
 * Orchestrates the recursive polling loop.
 * Fetches data via the Controller and distributes it to UI components 
 * once the backend status moves from 'processing' to 'ready'.
 */
 
 /**
 * Sticky Session Guard
 * Prevents the back button from leaving the dashboard if a session is active.
 */
/**
 * Silent Sticky Session Guard
 * Traps the back button using localStorage without triggering browser alerts.
 */
// Initialize the navigation guard immediately at the top of the file
initNavigationGuard();

async function startAnalysisPolling() {
    const id = getDatasetId();
    state.datasetId = id;

    try {
        // Request the latest analysis state from the Controller
        const data = await Controller.loadData();

        // Case 1: Backend is still computing (Plugins are still running)
        if (data && data.status === "processing") {
            console.log("Analysis in progress... polling again in 2s");
            
            // Show partial stats if available to improve perceived performance
            UI.updateStats(data); 
            
            // ✅ Explicitly wrap the call to ensure no string evaluation occurs
	    setTimeout(() => startAnalysisPolling(), 2000);
        } 
        
        // Case 2: Analysis complete
        else if (data && data.status === "ready") {
            console.log("Analysis ready. Distributing data to UI modules.");

            // 1. Update KPI counters (Rows, Cols, Quality Score)
            UI.updateMetrics(data);
            
            // Set visual placeholders immediately to improve UX
    	    UI.setCurrentFile(data.filename);
            
            // 2. Render the Data Leakage diagnostic card
            UI.updateLeakage(data.leakage);
            
            // 3. Update Target Column info and Imbalance status
            UI.updateImbalance(data.imbalance);
            
            // 4. Inject AI-generated cleanup suggestions
            UI.updateSuggestions(data.suggestions);
            
            // 5. Populate outlier warning tags
            UI.updateOutliers(data.outliers);
            
            // 6. Build the detailed descriptive statistics table
            UI.updateStats(data.statistics);

            // Finalize: Re-scan DOM for new icons injected by the update functions
            lucide.createIcons(); 
        }
    } catch (err) {
        console.error("Polling failed:", err);
        // Fallback: notify user of the connection/parsing error
    }
}

/**
 * Extracts the Dataset UUID from the URL path.
 * Fallback to 'preview-dataset' if no ID is found or if in dashboard root.
 * @returns {string} The dataset identifier.
 */
function getDatasetId() {
    const parts = window.location.pathname.split("/");
    let id = parts[parts.length - 1];

    // Validate ID; handle edge cases for dashboard home or blob previews
    if (!id || id === "dashboard" || id.includes("blob:")) {
        id = "preview-dataset";
    }
    return id;
}

/**
 * Initialization: Runs when the DOM is fully loaded.
 */
document.addEventListener("DOMContentLoaded", () => {
    // Initial icon render for static HTML elements
    lucide.createIcons();

    
    UI.setLoadingState(); 

    // Kick off the data retrieval process
    startAnalysisPolling();
});

/**
 * Sidebar Toggle Logic
 * Specifically for mobile view to trigger the slide-in drawer.
 */
function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) {
        const isActive = sidebar.classList.toggle('active');
        
        // Optional: Change the menu icon to an 'X' when open
        const toggleIcon = document.querySelector('.mobile-toggle i');
        if (toggleIcon) {
            const iconName = isActive ? 'x' : 'menu';
            toggleIcon.setAttribute('data-lucide', iconName);
            lucide.createIcons(); // Re-render the icon
        }
    }
}

/**
 * Click Outside Handler
 * Closes the sidebar if a user clicks on the main content area while the drawer is open.
 */
document.addEventListener('click', (e) => {
    const sidebar = document.querySelector('.sidebar');
    const toggle = document.querySelector('.mobile-toggle');
    
    // Only run if we are in mobile view and sidebar is actually open
    if (window.innerWidth <= 1024 && sidebar?.classList.contains('active')) {
        // If the click was NOT on the sidebar and NOT on the toggle button, close it
        if (!sidebar.contains(e.target) && !toggle.contains(e.target)) {
            sidebar.classList.remove('active');
            
            // Reset icon back to menu
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
 * Maps internal module methods to the 'window' object to allow 
 * access from inline HTML 'onclick' attributes.
 */
window.switchTableTab = Table.switch;
//window.cleanDataset = Actions.clean;
// Instead of: window.resetAnalysis = Actions.reset;
// Use a wrapper function:
window.resetAnalysis = async () => {
    try {
        await Actions.reset();
    } catch (err) {
        console.error("Global Reset Handler Error:", err);
        // Force a home redirect even if the API call fails
        window.location.href = "/";
    }
};
window.exportDataset = Actions.export;

window.toggleSidebar = toggleSidebar;


