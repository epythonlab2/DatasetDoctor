import { state } from "./ui/state.js";
import { Controller } from "./ui/controller.js";
import { UI } from "./ui/ui.js"; // Fixed double slash in your import
import { Table } from "./ui/table.js";
import { Actions } from "./ui/actions.js";

async function startAnalysisPolling() {
    const id = getDatasetId();
    state.datasetId = id;

    try {
        // Fetch the data
        const data = await Controller.loadData();

        // If the backend is still working, wait 2 seconds and try again
        if (data && data.status === "processing") {
            console.log("Analysis in progress... polling again in 2s");
            setTimeout(startAnalysisPolling, 2000);
        } else {
            console.log("Analysis ready. UI updated.");
            // Icons might need a re-draw if new elements were added to the DOM
            lucide.createIcons(); 
        }
    } catch (err) {
        console.error("Polling failed:", err);
    }
}

function getDatasetId() {
    const parts = window.location.pathname.split("/");
    let id = parts[parts.length - 1];

    if (!id || id === "dashboard" || id.includes("blob:")) {
        id = "preview-dataset";
    }
    return id;
}

document.addEventListener("DOMContentLoaded", () => {
    lucide.createIcons();

    // Initialize the UI with loading indicators immediately
    UI.setCurrentFile("current_dataset.csv");
    UI.setLoadingState(); // Call the helper we added to the UI object

    // Start the recursive polling loop
    startAnalysisPolling();
});

// Global exports
window.switchTableTab = Table.switch;
window.cleanDataset = Actions.clean;
window.resetAnalysis = Actions.reset;
window.exportDataset = Actions.export;
