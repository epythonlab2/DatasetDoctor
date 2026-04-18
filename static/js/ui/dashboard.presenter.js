// presenters/dashboard.presenter.js
import { UI } from "./ui.js";
import { Charts } from "./charts.js";
import { Table } from "./table.js";
import { state } from "../utils/state.js";

export const DashboardPresenter = {
  renderLoading() {
    UI.setLoadingState();
  },

  renderError(err) {
    console.error("Dashboard Error:", err);
  },

  render(data) {
    // --- STATE SYNC ---
    state.columns = data.columns;
    state.outliers = data.outliers;

    if (data.filename) {
      UI.setCurrentFile(data.filename);
    }

    // --- TIER 1 ---
    this._renderImmediate(data);

    // --- TIER 2 ---
    this._renderCharts(data);

    // --- TIER 3 ---
    this._renderHeavy(data);
  },

  _renderImmediate(data) {
    UI.updateMetrics(data);
    UI.updateImbalance(data.imbalance);
    UI.updateSuggestions(data.suggestions);
    UI.updateLeakage(data.leakage);
  },

  _renderCharts(data) {
    setTimeout(() => {
      if (data.imbalance) {
        Charts.renderImbalance(data.imbalance);
      }
    }, 0);
  },

  _renderHeavy(data) {
    setTimeout(() => {
      UI.updateStats(data.raw);
      UI.updateOutliers(state.outliers);
      Table.switch("health");
    }, 150);
  }
};
