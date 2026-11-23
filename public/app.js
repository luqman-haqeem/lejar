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

// After a failed submit, move focus to the error summary so screen readers announce it and its
// links (to each invalid field) are next in tab order.
document.querySelector(".error-summary")?.focus();

// Forms with data-confirm ask first (e.g. archiving a vehicle, deleting a service).
for (const form of document.querySelectorAll("form[data-confirm]")) {
  form.addEventListener("submit", (e) => {
    if (!confirm(form.dataset.confirm)) e.preventDefault();
  });
}

// Receipt photos: shrink before upload so the long edge is at most 1600 px, saved as JPEG at about
// 500 KB or less. If anything goes wrong the original file is uploaded and the server checks it.
const LONG_EDGE = 1600;
const TARGET_BYTES = 500 * 1024;

/** The decoded image plus a function to free it (iOS Safari is tight on canvas memory). */
async function decode(file) {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    return { image: bitmap, release: () => bitmap.close() };
  } catch {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.src = url;
    try {
      await img.decode();
    } catch (e) {
      URL.revokeObjectURL(url);
      throw e;
    }
    return { image: img, release: () => URL.revokeObjectURL(url) };
  }
}

const toJpeg = (canvas, quality) => new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));

async function shrink(file) {
  const { image, release } = await decode(file);
  const canvas = document.createElement("canvas");
  try {
    const scale = Math.min(1, LONG_EDGE / Math.max(image.width, image.height));
    canvas.width = Math.round(image.width * scale);
    canvas.height = Math.round(image.height * scale);
    canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
  } finally {
    release();
  }
  let blob = null;
  for (const quality of [0.8, 0.7, 0.6]) {
    blob = await toJpeg(canvas, quality);
    if (blob && blob.size <= TARGET_BYTES) break;
  }
  canvas.width = canvas.height = 0; // free the canvas backing store
  if (!blob) throw new Error("could not encode");
  return new File([blob], file.name.replace(/\.[^.]*$/, "") + ".jpg", { type: "image/jpeg" });
}

// Capture targets hide the native file name, so name the chosen photo (or say none is chosen).
for (const note of document.querySelectorAll("[data-file-name]")) {
  const input = note.parentElement?.parentElement?.querySelector("input[type=file]");
  if (!input) continue;
  const empty = note.textContent;
  input.addEventListener("change", () => {
    const file = input.files && input.files[0];
    note.textContent = file ? `Chosen: ${file.name}` : empty;
  });
}

for (const input of document.querySelectorAll("input[type=file][data-compress]")) {
  input.addEventListener("change", async () => {
    const file = input.files && input.files[0];
    if (!file || !file.type.startsWith("image/")) return;
    const buttons = input.form ? [...input.form.querySelectorAll("button[type=submit]")] : [];
    const label = input.parentElement?.querySelector("[data-file-name]") ?? input.closest("label")?.querySelector("span");
    const named = label?.hasAttribute("data-file-name");
    const original = label?.textContent;
    buttons.forEach((b) => (b.disabled = true));
    if (label) label.textContent = "Preparing photo…";
    try {
      const small = await shrink(file);
      const files = new DataTransfer();
      files.items.add(small);
      input.files = files.files;
    } catch {
      // Keep the original; the server rejects it if it's too large.
    } finally {
      buttons.forEach((b) => (b.disabled = false));
      // A capture target names the photo that will actually be sent; a plain label goes back to what it said.
      if (label) label.textContent = named ? `Chosen: ${input.files[0]?.name ?? file.name}` : original;
    }
  });
}

// Forms with data-busy can't be sent twice (a second tap while the first is on its way would save
// twice), and show that message on the pressed button while the server works. Buttons are disabled
// only after the browser has read the form, so the pressed button's value (e.g. "Save & add
// another") is still sent.
for (const form of document.querySelectorAll("form[data-busy]")) {
  form.addEventListener("submit", (e) => {
    if (e.defaultPrevented) return; // e.g. a data-confirm the user declined
    if (form.dataset.sending) {
      e.preventDefault();
      return;
    }
    form.dataset.sending = "1";
    const pressed = e.submitter ?? form.querySelector("button[type=submit]");
    setTimeout(() => {
      for (const button of form.querySelectorAll("button[type=submit]")) button.disabled = true;
      if (pressed) pressed.textContent = form.dataset.busy;
    });
  });
}
// Coming back to a page from the browser's history restores it as it was: make its forms usable again.
window.addEventListener("pageshow", (e) => {
  if (!e.persisted) return;
  for (const form of document.querySelectorAll("form[data-busy][data-sending]")) {
    delete form.dataset.sending;
    for (const button of form.querySelectorAll("button[type=submit]")) button.disabled = false;
  }
});

// "Print / Save as PDF": the browser's own print dialog (Save as PDF on iPhone via Share → Print).
for (const button of document.querySelectorAll("button[data-print]")) {
  button.addEventListener("click", () => window.print());
}

// Appearance (Profile): text size and theme, saved on this device. The inline script in <head>
// applies them on every page before it paints; this keeps the radios in sync and applies changes live.
const PREFS = { "text-size": { key: "lejar-text-size", attr: "textSize" }, theme: { key: "lejar-theme", attr: "theme" } };
for (const input of document.querySelectorAll("input[data-pref]")) {
  const pref = PREFS[input.dataset.pref];
  if (!pref) continue;
  let saved = null;
  try {
    saved = localStorage.getItem(pref.key);
  } catch {}
  if (saved) input.checked = input.value === saved;
  input.addEventListener("change", () => {
    if (!input.checked) return;
    document.documentElement.dataset[pref.attr] = input.value;
    window.lejarScheme?.(); // re-resolve light or dark for the new Theme choice
    try {
      localStorage.setItem(pref.key, input.value);
    } catch {}
  });
}

// Vehicle form: the make and model suggestions and the placeholders follow the vehicle type; a common
// model is one tap; the name follows the model until the user types their own.
for (const details of document.querySelectorAll("fieldset[data-examples]")) {
  const form = details.form;
  const examples = JSON.parse(details.dataset.examples);
  const field = (n) => form.elements.namedItem(n);
  const make = field("make");
  const model = field("model");
  const name = field("name");
  const picks = details.querySelector("[data-picks]");
  const allModels = {}; // type -> every <option> of its models list, to filter by make
  for (const list of document.querySelectorAll("datalist[id^=models-]")) allModels[list.id] = [...list.children];

  const type = () => form.querySelector("input[name=type]:checked")?.value ?? (make.getAttribute("list") || "makes-car").slice(6);
  const filterModels = () => {
    const id = `models-${type()}`;
    const options = allModels[id] ?? [];
    const typed = make.value.trim().toLowerCase();
    const matching = options.filter((o) => o.dataset.make.toLowerCase() === typed);
    document.getElementById(id)?.replaceChildren(...(matching.length ? matching : options));
  };
  const markPicks = () => {
    for (const b of details.querySelectorAll(".pick"))
      b.setAttribute("aria-pressed", String(b.dataset.make === make.value.trim() && b.dataset.model === model.value.trim()));
  };
  const nameFollowsModel = () => {
    const eg = examples[type()] ?? examples.car;
    if (name.dataset.auto) name.value = model.value.trim();
    name.placeholder = model.value.trim() || `e.g. ${eg.name}`;
  };
  const applyType = () => {
    const t = type();
    const eg = examples[t] ?? examples.car;
    make.setAttribute("list", `makes-${t}`);
    model.setAttribute("list", `models-${t}`);
    make.placeholder = `e.g. ${eg.make}`;
    model.placeholder = `e.g. ${eg.model}`;
    field("plate").placeholder = `e.g. ${eg.plate}`;
    for (const row of details.querySelectorAll(".pick-row")) row.hidden = row.dataset.type !== t;
    filterModels();
    nameFollowsModel();
  };

  // Adding a vehicle: a name left blank (or matching the model) follows the model; typing a different
  // one stops that. Editing never renames.
  if (picks && (name.value === "" || name.value === model.value)) name.dataset.auto = "1";
  if (picks) name.addEventListener("input", () => {
    if (name.value.trim() === "" || name.value === model.value) name.dataset.auto = "1";
    else delete name.dataset.auto;
  });
  make.addEventListener("input", () => (filterModels(), markPicks()));
  model.addEventListener("input", () => (nameFollowsModel(), markPicks()));
  // Switching type clears a common model picked for the other type (a Myvi isn't a motorbike).
  const clearOtherTypePick = () => {
    const picked = details.querySelector(`.pick-row:not([data-type="${type()}"]) .pick[aria-pressed="true"]`);
    if (!picked) return;
    make.value = model.value = "";
    if (name.dataset.auto) name.value = "";
  };
  for (const radio of form.querySelectorAll("input[name=type]"))
    radio.addEventListener("change", () => {
      clearOtherTypePick();
      applyType();
      markPicks();
    });
  for (const b of details.querySelectorAll(".pick"))
    b.addEventListener("click", () => {
      make.value = b.dataset.make;
      model.value = b.dataset.model;
      filterModels();
      nameFollowsModel();
      markPicks();
    });
  if (picks) picks.hidden = false;
  applyType();
  markPicks();
}

// Part details: a spec that looks like a tyre size is written the standard way as the field is left
// ("2055516" → "205/55 R16"; the server does the same), and the warranty quick picks set "until"
// to that many months after the service date (or today, before a date is entered).
const TYRE_SIZE = /^(\d{3})\s*[/ ]?\s*(\d{2})\s*[/ ]?\s*R?\s*(\d{2})(?:\s*(\d{2,3}[A-Z]))?$/;
document.addEventListener("focusout", (e) => {
  const input = e.target;
  if (!(input instanceof HTMLInputElement) || !/^line\.\d+\.spec$/.test(input.name)) return;
  const m = input.value.trim().toUpperCase().match(TYRE_SIZE);
  if (m) input.value = `${m[1]}/${m[2]} R${m[3]}${m[4] ? ` ${m[4]}` : ""}`;
});
const showWarrantyPicks = (root) => {
  for (const picks of root.querySelectorAll("[data-warranty-picks]")) picks.hidden = false;
};
showWarrantyPicks(document);
new MutationObserver(() => showWarrantyPicks(document)).observe(document.getElementById("lines") ?? document.createElement("div"), { childList: true });
document.addEventListener("click", (e) => {
  const pick = e.target instanceof Element && e.target.closest("[data-months]");
  if (!pick) return;
  const until = pick.closest(".warranty")?.querySelector("input[type=date]");
  const serviceDate = pick.form?.elements.namedItem("date")?.value;
  if (!until) return;
  const from = /^\d{4}-\d{2}-\d{2}$/.test(serviceDate ?? "") ? new Date(`${serviceDate}T00:00:00Z`) : new Date();
  // Same as addMonths in src/lib/dates.ts: 31 Aug + 18 months is 28 Feb, not 3 Mar.
  const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + Number(pick.dataset.months), 1));
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(from.getUTCDate(), lastDay));
  until.value = d.toISOString().slice(0, 10);
});

// Categories: picking a line's reminder fills its category with the item's (the server does the same
// when none is chosen), and keeps following the reminder until the owner picks a category themselves.
document.addEventListener("change", (e) => {
  const select = e.target;
  if (!(select instanceof HTMLSelectElement)) return;
  const m = select.name.match(/^line\.(\d+)\.(item|category)$/);
  if (!m) return;
  const category = select.form?.elements.namedItem(`line.${m[1]}.category`);
  if (!(category instanceof HTMLSelectElement)) return;
  if (m[2] === "category") {
    delete category.dataset.auto;
    return;
  }
  if (category.value !== "" && !category.dataset.auto) return;
  category.value = select.selectedOptions[0]?.dataset.category ?? "";
  category.dataset.auto = "1";
});

// Service form: the Odometer hint follows the Date field. The server precomputes the text for every
// date range (data-odometer-hints, see src/lib/odometer-hint.ts); this only finds the one for the date.
// An empty date counts as after every reading.
for (const hint of document.querySelectorAll("[data-odometer-hints]")) {
  const date = hint.closest("form")?.elements.namedItem("date");
  if (!(date instanceof HTMLInputElement)) continue;
  const { before, dates } = JSON.parse(hint.dataset.odometerHints);
  const textFor = (d) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return dates.at(-1)[2];
    let text = before;
    for (const [on, sameDay, after] of dates) {
      if (on === d) return sameDay;
      if (on < d) text = after;
    }
    return text;
  };
  const update = () => (hint.textContent = textFor(date.value));
  date.addEventListener("input", update);
  date.addEventListener("change", update);
}
