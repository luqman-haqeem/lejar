import type { Child } from "hono/jsx";
import type { FormErrors } from "../form";

export function ErrorSummary({ errors }: { errors: FormErrors }) {
  const messages = [...new Set(Object.values(errors))];
  if (messages.length === 0) return null;
  return (
    <div class="error-summary" role="alert">
      <p>Please fix the following:</p>
      <ul>
        {messages.map((m) => (
          <li>{m}</li>
        ))}
      </ul>
    </div>
  );
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
};

export function Field({ label, name, value, errors, errorKey = name, type = "text", ...rest }: FieldProps) {
  const invalid = errorKey in errors;
  return (
    <label class={invalid ? "field invalid" : "field"}>
      <span>{label}</span>
      <input name={name} type={type} value={value} aria-invalid={invalid ? "true" : undefined} {...rest} />
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
  const all = last && !last.id && Object.values(last).every((v) => v === "") ? rows : [...rows, blank];
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
