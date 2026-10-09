export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

export function renderTags(values) {
  return `<div class="tag-row">${values.map((value) => `<span class="tag">${escapeHtml(value)}</span>`).join("")}</div>`;
}
