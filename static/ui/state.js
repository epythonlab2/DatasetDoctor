/**
 * Global Application State
 * Acts as a centralized store for dataset metadata, analysis results, 
 * and active UI component instances (like Chart.js objects).
 */
export const state = {
    /** @type {string|null} The unique identifier for the current dataset session */
    datasetId: null,

    /** @type {Array<Object>} List of column metadata (name, type, missingPercent, etc.) */
    columns: [],

    /** @type {Object} Key-value store of column names and their outlier statistics */
    outliers: {},

    /** @type {number} The total number of rows in the processed dataset */
    totalRows: 0,

    /** * @property {Object} charts - Holds references to active Chart.js instances.
     * Storing these here allows us to call .destroy() before re-rendering,
     * preventing memory leaks and overlapping canvas elements.
     */
    charts: {
        /** @type {Object|null} Reference to the Pearson/Spearman correlation heatmap */
        correlation: null,
        
        /** @type {Object|null} Reference to the Class Distribution doughnut chart */
        imbalance: null
    }
};
