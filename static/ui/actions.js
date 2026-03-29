import { API } from "./api.js";
import { state } from "./state.js";

export const Actions = {
    async clean() {
        const btn = event.target;
        const original = btn.innerHTML;

        btn.innerHTML = "Cleaning...";
        btn.disabled = true;

        try {
            const res = await API.cleanDataset(state.datasetId);
            if (res.ok) alert("Dataset cleaned!");
            else throw new Error();
        } catch {
            alert("Preview clean simulated.");
        } finally {
            btn.innerHTML = original;
            btn.disabled = false;
        }
    },

    async reset() {
        if (!confirm("Reset analysis?")) return;

        try {
            const res = await API.reset();
            if (res.ok) window.location.href = "/";
        } catch {
            window.location.reload();
        }
    },

    export() {
        window.location.href = API.getUrl(`/export/${state.datasetId}`);
    }
};
