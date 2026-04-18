// controller.js
import { DashboardService } from "./dashboard.service.js";
import { DashboardPresenter } from "./dashboard.presenter.js";

export const Controller = {
  async loadData() {
    try {
      const result = await DashboardService.getAnalysis();

      if (result.status === "processing") {
        DashboardPresenter.renderLoading();
        DashboardService.scheduleRetry(() => this.loadData());
        return;
      }

      DashboardPresenter.render(result);

    } catch (err) {
      DashboardPresenter.renderError(err);
    }
  }
};
