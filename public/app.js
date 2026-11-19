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

// Forms with data-busy show that message on their submit button while the server works (e.g. the
// AI reading a receipt), and can't be sent twice.
for (const form of document.querySelectorAll("form[data-busy]")) {
  form.addEventListener("submit", () => {
    for (const button of form.querySelectorAll("button[type=submit]")) {
      button.disabled = true;
      button.textContent = form.dataset.busy;
    }
  });
}

// "Print / Save as PDF": the browser's own print dialog (Save as PDF on iPhone via Share → Print).
for (const button of document.querySelectorAll("button[data-print]")) {
  button.addEventListener("click", () => window.print());
}

// Appearance (Profile): text size and theme, saved on this device. The inline script in <head>
// applies them on every page before it paints; this keeps the radios in sync and applies changes live.
const PREFS = { "text-size": { key: "kereta-text-size", attr: "textSize" }, theme: { key: "kereta-theme", attr: "theme" } };
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
    try {
      localStorage.setItem(pref.key, input.value);
    } catch {}
  });
}
