export function initNavigationGuard() {
    // 1. Initial history anchor
    window.history.pushState({ locked: true }, "", window.location.href);

    const silentLock = () => {
        const datasetId = localStorage.getItem("dataset_id");

        if (datasetId && !window.isInternalNavigation) {
            window.history.pushState({ locked: true }, "", window.location.href);
            window.location.replace(`/dashboard/${encodeURIComponent(datasetId)}`);
            console.log("Back button silenced: Active session found.");
        }
        else{
           // Re-push the state to stay on the current page
            window.history.pushState({ locked: false }, "", window.location.href);
            // Use replace to ensure the URL is clean and the app stays mounted
            window.location.replace('/uploader');
        }
    };

    window.addEventListener('popstate', silentLock);
}
