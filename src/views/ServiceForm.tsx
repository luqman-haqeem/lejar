import type { ServiceItem, Vehicle } from "../db";
import type { FormErrors } from "../form";
import type { LineValues, ServiceFormValues } from "../service-form";
import { ErrorSummary, Field, RepeatableRows } from "./fields";
import { Layout } from "./Layout";

const blankLine: LineValues = { description: "", cost: "", item: "" };

function LineRow({ line, n, items, errors }: { line: LineValues; n: number | "__N__"; items: ServiceItem[]; errors: FormErrors }) {
  const name = (f: string) => `line.${n}.${f}`;
  return (
    <div class="item">
      <Field label="Work or part" name={name("description")} value={line.description} errors={errors} />
      <div class="pair">
        <Field label="Cost (RM)" name={name("cost")} value={line.cost} errors={errors} inputmode="decimal" />
        <label class="field">
          <span>Schedule item</span>
          <select name={name("item")}>
            <option value="">—</option>
            {items.map((i) => (
              <option value={String(i.id)} selected={line.item === String(i.id)}>
                {i.name}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}

export type ServiceFormMode = { kind: "new" } | { kind: "edit"; serviceId: number };

export function ServiceForm({
  vehicle,
  items,
  values,
  mode,
  errors = {},
  saved = false,
}: {
  vehicle: Vehicle;
  items: ServiceItem[];
  values: ServiceFormValues;
  mode: ServiceFormMode;
  errors?: FormErrors;
  saved?: boolean;
}) {
  const v = values.service;
  const isNew = mode.kind === "new";
  return (
    <Layout title={isNew ? "Log a service" : "Edit service"} signedIn>
      <p class="crumb">
        <a href={`/vehicles/${vehicle.id}`}>← {vehicle.name}</a>
      </p>
      <h1>{isNew ? "Log a service" : "Edit service"}</h1>
      {saved && (
        <p class="notice" role="status">
          Saved. Add the next one.
        </p>
      )}
      <ErrorSummary errors={errors} />
      <form method="post" action={isNew ? "/services" : `/services/${mode.serviceId}`} class="vehicle-form">
        {isNew && <input type="hidden" name="vehicle_id" value={String(vehicle.id)} />}
        <fieldset>
          <legend>Visit</legend>
          <div class="pair">
            <Field label="Date" name="date" type="date" value={v.date} errors={errors} required />
            <Field label="Odometer (km)" name="odometer_km" value={v.odometer_km} errors={errors} inputmode="numeric" required />
          </div>
          <Field label="Workshop" name="workshop" value={v.workshop} errors={errors} />
          <Field
            label="Total (RM)"
            name="total"
            value={v.total}
            errors={errors}
            inputmode="decimal"
            placeholder="Blank = sum of the lines"
          />
          <label class="field">
            <span>Notes</span>
            <textarea name="notes" rows={2}>
              {v.notes}
            </textarea>
          </label>
        </fieldset>
        <fieldset>
          <legend>Lines</legend>
          <p class="hint">Tag a line with a schedule item to reset when that item is next due.</p>
          <RepeatableRows
            id="lines"
            rows={values.lines}
            blank={blankLine}
            addLabel="Add line"
            render={(line, n) => <LineRow line={line} n={n} items={items} errors={errors} />}
          />
        </fieldset>
        <div class="actions">
          <button type="submit" class="button" name="action" value="save">
            Save
          </button>
          {isNew && (
            <button type="submit" class="secondary" name="action" value="save_add">
              Save &amp; add another
            </button>
          )}
        </div>
      </form>
      <script src="/app.js" defer></script>
    </Layout>
  );
}
