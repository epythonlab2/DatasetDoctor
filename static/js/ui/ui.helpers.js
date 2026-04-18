// ui/ui.helpers.js

export const UIHelpers = {
  get(id) {
    return document.getElementById(id);
  },

  setLoading(btnId, isLoading, text = "") {
    const btn = this.get(btnId);
    if (!btn) return;

    btn.disabled = isLoading;

    if (isLoading) {
      btn.dataset.original = btn.innerHTML;
      btn.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>${text}`;
    } else {
      btn.innerHTML = btn.dataset.original || btn.innerHTML;
    }
  },

  updateStatus(text, color) {
    const label = document.querySelector(".live-indicator .small");
    const dot = document.querySelector(".live-indicator .dot");

    if (label) label.textContent = text;
    if (dot) dot.style.backgroundColor = color;
  },

  togglePopup(id, event, outsideClose = false) {
    if (event) event.stopPropagation();

    const el = this.get(id);
    if (!el) return;

    const open = el.style.display === "block";
    el.style.display = open ? "none" : "block";

    if (!open && outsideClose) {
      const handler = () => {
        el.style.display = "none";
        document.removeEventListener("click", handler);
      };
      setTimeout(() => document.addEventListener("click", handler), 10);
    }
  }
};
