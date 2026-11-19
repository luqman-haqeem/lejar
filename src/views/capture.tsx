import type { FormErrors } from "../form";
import { errorId, FieldError, fieldId } from "./fields";
import { CameraIcon } from "./icons";

/**
 * A receipt photo picker drawn as one large tap target. The real file input covers it invisibly, so
 * taps, keyboard and screen readers all reach the native control (iOS offers camera or library).
 * public/app.js shrinks the photo and shows the chosen file's name in [data-file-name].
 */
export function PhotoCapture({
  title,
  note,
  required = false,
  errors = {},
}: {
  title: string;
  note: string;
  required?: boolean;
  errors?: FormErrors;
}) {
  const invalid = "photo" in errors;
  return (
    <div class={invalid ? "capture invalid" : "capture"}>
      <input
        type="file"
        name="photo"
        id={fieldId("photo")}
        accept="image/*"
        required={required}
        data-compress
        aria-invalid={invalid ? "true" : undefined}
        aria-describedby={invalid ? errorId("photo") : undefined}
      />
      <label class="capture-face" for={fieldId("photo")}>
        <CameraIcon />
        <span class="capture-title">{title}</span>
        <span class="capture-note" data-file-name>
          {note}
        </span>
      </label>
      <FieldError name="photo" errors={errors} />
    </div>
  );
}
