// ui.engine.js

export const UIEngine = {
  get(id) {
    return document.getElementById(id);
  },

  setText(id, value) {
    const el = this.get(id);
    if (el) el.textContent = value;
  },

  setHTML(id, html) {
    const el = this.get(id);
    if (el) el.innerHTML = html;
  },

  setStyle(id, styles) {
    const el = this.get(id);
    if (!el) return;
    Object.assign(el.style, styles);
  },

  setDisplay(id, value) {
    const el = this.get(id);
    if (el) el.style.display = value;
  },

  query(selector) {
    return document.querySelector(selector);
  }
};
