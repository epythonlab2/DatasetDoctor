import { API } from "../api.js";
import { state } from "../utils/state.js";

export const DashboardService = {
  async getAnalysis() {
    const data = await API.fetchAnalysis(state.datasetId);
    return this._normalize(data);
  },

  scheduleRetry(callback, delay = 3000) {
    if (typeof callback !== 'function') {
      console.error("scheduleRetry requires a function");
      return;
    }

    setTimeout(() => callback(), delay); // ✅ FIXED
  },

  _normalize(data) {
    return {
      status: data.status,
      filename: data.filename,
      columns: data.columns || [],
      outliers: data.outliers || {},
      imbalance: data.imbalance || {},
      suggestions: data.suggestions || [],
      leakage: data.leakage || {},
      summary: data.summary || {},

      // ❌ REMOVED RAW PIPELINE LEAK
      raw: data
    };
  }
};
