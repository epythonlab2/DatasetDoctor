import { DashboardService } from "./dashboard.service.js";
import { DashboardPresenter } from "./dashboard.presenter.js";

export const Controller = {
    async loadData() {
        try {
            // Fetch and Normalize
            const result = await DashboardService.getAnalysis();
            if (!result) return;

            // Update UI via Presenter
            DashboardPresenter.render(result);

            // Handle Polling State
            if (result.status === "processing") {
                console.log(`Analyzing: ${result.stage || 'In Progress'}`);
                DashboardService.scheduleRetry(() => this.loadData());
            } else if (result.status === "ready") {
                console.log("Analysis ready.");
            }
        } catch (err) {
            DashboardPresenter.renderError(err);
        }
    }
};
