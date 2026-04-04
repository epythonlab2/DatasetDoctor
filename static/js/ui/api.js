const getUrl = (path) => {
    const origin = window.location.origin;
    return origin + (path.startsWith('/') ? '' : '/') + path;
};

export const API = {
    getUrl,

    async fetchAnalysis(id) {
        const res = await fetch(getUrl(`/analysis/${id}`));
        if (!res.ok) throw new Error("Failed to fetch analysis");
        return res.json();
    },

    async cleanDataset(id) {
        return fetch(getUrl(`/clean/${id}`));
    },

    async reset() {
        return fetch(getUrl("/reset"), { method: "POST" });
    }
};
