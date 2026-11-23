import type { Child } from "hono/jsx";
import { type FormErrors, isBlankRow } from "../form";

/** The id of a form control, which error summary links point to. */
export const fieldId = (name: string) => `f-${name}`;
export const errorId = (name: string) => `${fieldId(name)}-error`;

/** Failed-submit summary: one link per distinct message, to its field. public/app.js focuses it on load. */
export function ErrorSummary({ errors }: { errors: FormErrors }) {
  const byMessage = new Map<string, string>();
  for (const [key, message] of Object.entries(errors)) if (!byMessage.has(message)) byMessage.set(message, key);
  if (byMessage.size === 0) return null;
  return (
    <div class="error-summary" role="alert" tabindex={-1} aria-labelledby="error-summary-title">
      <p id="error-summary-title">Please fix the following:</p>
      <ul>
        {[...byMessage].map(([message, key]) => (
          <li>
            <a href={`#${fieldId(key)}`}>{message}</a>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** A field's own error message, shown under it. */
export function FieldError({ name, errors }: { name: string; errors: FormErrors }) {
  return name in errors ? (
    <span class="field-error" id={errorId(name)}>
      {errors[name]}
    </span>
  ) : null;
}

export type FieldProps = {
  label: string;
  name: string;
  value: string;
  errors: FormErrors;
  errorKey?: string;
  type?: string;
  inputmode?: "numeric" | "decimal" | "text";
  placeholder?: string;
  required?: boolean;
  autocapitalize?: "characters";
  max?: string;
  maxlength?: number;
  /** Id of a <datalist> of suggestions. */
  list?: string;
  autocomplete?: "off";
  /** Id of a hint shown near the field, read out with it. */
  hint?: string;
  /** Marks a field the receipt scan couldn't read, for the user to fill in. */
  highlight?: boolean;
};

export function Field({ label, name, value, errors, errorKey = name, type = "text", highlight, hint, ...rest }: FieldProps) {
  const invalid = errorKey in errors;
  const describedBy = [invalid && errorId(errorKey), hint].filter(Boolean).join(" ");
  return (
    <label class={invalid ? "field invalid" : highlight ? "field unread" : "field"}>
      <span>{label}</span>
      <input
        name={name}
        id={fieldId(errorKey)}
        type={type}
        value={value}
        aria-invalid={invalid ? "true" : undefined}
        aria-describedby={describedBy || undefined}
        {...rest}
      />
      <FieldError name={errorKey} errors={errors} />
    </label>
  );
}

/**
 * Numbered form rows that always end with one blank row, so a row can be added without JS.
 * With JS (public/app.js), the "Add" button clones the template row with the next free index.
 */
export function RepeatableRows<R extends Record<string, string>>({
  id,
  rows,
  blank,
  addLabel,
  render,
}: {
  id: string;
  rows: R[];
  blank: R;
  addLabel: string;
  render: (row: R, n: number | "__N__") => Child;
}) {
  const last = rows.at(-1);
  const all = last && isBlankRow(last) ? rows : [...rows, blank];
  return (
    <>
      <div id={id} data-next={all.length}>
        {all.map((row, n) => render(row, n))}
      </div>
      <template id={`${id}-template`}>{render(blank, "__N__")}</template>
      <button type="button" class="secondary" data-add-row={id} hidden>
        {addLabel}
      </button>
    </>
  );
}
