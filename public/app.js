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

// Receipt photos: shrink before upload so the long edge is at most 1600 px, saved as JPEG at about
// 500 KB or less. If anything goes wrong the original file is uploaded and the server checks it.
const LONG_EDGE = 1600;
const TARGET_BYTES = 500 * 1024;

async function decode(file) {
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    const img = new Image();
    img.src = URL.createObjectURL(file);
    await img.decode();
    return img;
  }
}

const toJpeg = (canvas, quality) => new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));

async function shrink(file) {
  const image = await decode(file);
  const scale = Math.min(1, LONG_EDGE / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(image.width * scale);
  canvas.height = Math.round(image.height * scale);
  canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
  let blob = null;
  for (const quality of [0.8, 0.7, 0.6]) {
    blob = await toJpeg(canvas, quality);
    if (blob && blob.size <= TARGET_BYTES) break;
  }
  if (!blob) throw new Error("could not encode");
  return new File([blob], file.name.replace(/\.[^.]*$/, "") + ".jpg", { type: "image/jpeg" });
}

for (const input of document.querySelectorAll("input[type=file][data-compress]")) {
  input.addEventListener("change", async () => {
    const file = input.files && input.files[0];
    if (!file || !file.type.startsWith("image/")) return;
    const buttons = input.form ? [...input.form.querySelectorAll("button[type=submit]")] : [];
    const label = input.closest("label")?.querySelector("span");
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
      if (label) label.textContent = original;
    }
  });
}
