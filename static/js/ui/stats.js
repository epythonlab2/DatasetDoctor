/**
 * Logic for processing column-level statistics and health scores.
 */
export const Stats = {
    /**
     * Calculates a health score for a column based on missing values and outliers.
     * @param {Object} column - The column data object.
     * @returns {number} - Percentage score (0-100)
     */
    calculateHealthScore(column) {
        const missingPct = column.missing_percentage || 0;
        const outlierPct = column.outlier_percentage || 0;
        
        // Simple weighted health formula
        const score = 100 - (missingPct * 0.7 + outlierPct * 0.3);
        return Math.max(0, Math.round(score));
    },

    /**
     * Groups raw data into categories (Numeric vs Categorical) 
     * for easier UI rendering.
     */
    categorizeColumns(columns) {
        return columns.reduce((acc, col) => {
            const type = col.type?.toLowerCase();
            if (['int64', 'float64', 'number'].includes(type)) {
                acc.numeric.push(col);
            } else {
                acc.categorical.push(col);
            }
            return acc;
        }, { numeric: [], categorical: [] });
    },

    /**
     * Formats large numbers for UI display (e.g., 1500 -> 1.5k)
     */
    formatMetric(value) {
        if (value >= 1000000) return (value / 1000000).toFixed(1) + 'M';
        if (value >= 1000) return (value / 1000).toFixed(1) + 'k';
        return value;
    }
};
