import type { ServiceItem, Vehicle } from "../db";
import type { FormErrors } from "../form";
import type { LineValues, ServiceFormValues } from "../service-form";
import { ErrorSummary, Field, RepeatableRows } from "./fields";
import { receiptUrl } from "../receipts";
import { Layout } from "./Layout";

const blankLine: LineValues = { description: "", cost: "", item: "" };

function LineRow({
  line,
  n,
  items,
  errors,
  unread,
}: {
  line: LineValues;
  n: number | "__N__";
  items: ServiceItem[];
  errors: FormErrors;
  unread: Set<string>;
}) {
  const name = (f: string) => `line.${n}.${f}`;
  return (
    <div class="item">
      <Field label="Work or part" name={name("description")} value={line.description} errors={errors} />
      <div class="pair">
        <Field
          label="Cost (RM)"
          name={name("cost")}
          value={line.cost}
          errors={errors}
          inputmode="decimal"
          highlight={unread.has(name("cost"))}
        />
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

function ReceiptPhoto({ receiptKey, errors }: { receiptKey: string | null; errors: FormErrors }) {
  return (
    <fieldset class="receipt">
      <legend>Receipt photo</legend>
      <input type="hidden" name="receipt_key" value={receiptKey ?? ""} />
      {receiptKey && (
        <>
          <img class="receipt-img" src={receiptUrl(receiptKey)} alt="Receipt photo" />
          <label class="remove">
            <input type="checkbox" name="remove_photo" value="1" /> Remove this photo
          </label>
        </>
      )}
      <label class={"photo" in errors ? "field invalid" : "field"}>
        <span>{receiptKey ? "Replace photo" : "Attach a photo"}</span>
        <input type="file" name="photo" accept="image/*" data-compress />
      </label>
    </fieldset>
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
  receiptKey = null,
  unread = [],
  notice,
}: {
  vehicle: Vehicle;
  items: ServiceItem[];
  values: ServiceFormValues;
  mode: ServiceFormMode;
  errors?: FormErrors;
  saved?: boolean;
  /** The photo already attached to this form, if any. */
  receiptKey?: string | null;
  /** Field names a receipt scan couldn't read. */
  unread?: string[];
  /** A banner above the form, e.g. after a scan. */
  notice?: string;
}) {
  const v = values.service;
  const unreadFields = new Set(unread);
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
      {notice && (
        <p class="notice scan-notice" role="status">
          {notice}
        </p>
      )}
      <ErrorSummary errors={errors} />
      <form
        method="post"
        action={isNew ? "/services" : `/services/${mode.serviceId}`}
        enctype="multipart/form-data"
        class="vehicle-form"
      >
        {isNew && <input type="hidden" name="vehicle_id" value={String(vehicle.id)} />}
        <ReceiptPhoto receiptKey={receiptKey} errors={errors} />
        <fieldset>
          <legend>Visit</legend>
          <div class="pair">
            <Field label="Date" name="date" type="date" value={v.date} errors={errors} required highlight={unreadFields.has("date")} />
            <Field
              label="Odometer (km)"
              name="odometer_km"
              value={v.odometer_km}
              errors={errors}
              inputmode="numeric"
              required
              highlight={unreadFields.has("odometer_km")}
            />
          </div>
          <Field label="Workshop" name="workshop" value={v.workshop} errors={errors} highlight={unreadFields.has("workshop")} />
          <Field
            label="Total (RM)"
            name="total"
            value={v.total}
            errors={errors}
            inputmode="decimal"
            placeholder="Blank = sum of the lines"
            highlight={unreadFields.has("total")}
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
            render={(line, n) => <LineRow line={line} n={n} items={items} errors={errors} unread={unreadFields} />}
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
