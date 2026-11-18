// Progressive enhancement only: every form works without this file.

// "Add item" on the schedule: clone the template row with the next free index.
const items = document.getElementById("items");
const template = document.getElementById("item-template");
const addItem = document.querySelector("[data-add-item]");
if (items && template && addItem) {
  addItem.hidden = false;
  addItem.addEventListener("click", () => {
    const n = Number(items.dataset.next);
    items.dataset.next = String(n + 1);
    const html = template.innerHTML.replaceAll("__N__", String(n));
    items.insertAdjacentHTML("beforeend", html);
    items.lastElementChild?.querySelector("input:not([type=hidden])")?.focus();
  });
}

// Forms with data-confirm ask first (e.g. archiving a vehicle).
for (const form of document.querySelectorAll("form[data-confirm]")) {
  form.addEventListener("submit", (e) => {
    if (!confirm(form.dataset.confirm)) e.preventDefault();
  });
}
