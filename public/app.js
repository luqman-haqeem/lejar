// Progressive enhancement only: every form works without this file.

// Repeatable rows (schedule items, service lines): a button[data-add-row="<id>"] clones
// template#<id>-template into #<id>, replacing __N__ with the next free row index.
for (const button of document.querySelectorAll("button[data-add-row]")) {
  const rows = document.getElementById(button.dataset.addRow);
  const template = document.getElementById(`${button.dataset.addRow}-template`);
  if (!rows || !template) continue;
  button.hidden = false;
  button.addEventListener("click", () => {
    const n = Number(rows.dataset.next);
    rows.dataset.next = String(n + 1);
    rows.insertAdjacentHTML("beforeend", template.innerHTML.replaceAll("__N__", String(n)));
    rows.lastElementChild?.querySelector("input:not([type=hidden])")?.focus();
  });
}

// Forms with data-confirm ask first (e.g. archiving a vehicle, deleting a service).
for (const form of document.querySelectorAll("form[data-confirm]")) {
  form.addEventListener("submit", (e) => {
    if (!confirm(form.dataset.confirm)) e.preventDefault();
  });
}
