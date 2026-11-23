import type { ServiceItem, Vehicle } from "../db";
import { type FormErrors, isBlankRow } from "../form";
import type { LineValues, ServiceFormValues } from "../service-form";
import { PhotoCapture } from "./capture";
import { ErrorSummary, Field, FieldError, fieldId, RepeatableRows } from "./fields";
import { receiptUrl } from "../receipts";
import { BackIcon } from "./icons";
import { Layout } from "./Layout";
import { parseDateInput } from "../lib/dates";
import { CATEGORIES, itemCategory, MAX_CATEGORY_NAME, NEW_CATEGORY } from "../lib/categories";
import { partSummary, positionsFor } from "../lib/parts";
import { type HintReading, odometerHint, odometerHintLookup } from "../lib/odometer-hint";

const blankLine: LineValues = { description: "", cost: "", item: "", brand: "", spec: "", position: "", warranty_until: "", category: "", new_category: "" };

const WARRANTY_MONTHS = [12, 18, 24];

/** Brand, spec, position and warranty under a line: a one-line summary that opens to the fields. */
function PartDetailsFields({
  line,
  name,
  positions,
  errors,
  today,
}: {
  line: LineValues;
  name: (f: string) => string;
  positions: readonly string[];
  errors: FormErrors;
  today: string;
}) {
  const invalid = name("position") in errors || name("warranty_until") in errors;
  const warranty = parseDateInput(line.warranty_until);
  const summary = partSummary(
    {
      part_brand: line.brand || null,
      part_spec: line.spec || null,
      part_position: line.position || null,
      warranty_until: warranty,
    },
    today,
  );
  return (
    <details class="part-details-edit" open={invalid}>
      <summary>
        {summary ? (
          <>
            <span class="part-summary">{summary}</span>
            <span class="part-toggle">
              <span class="when-closed">Edit</span>
              <span class="when-open">Close</span>
            </span>
          </>
        ) : (
          <span class="part-add">
            <span class="when-closed">+ Part details</span>
            <span class="when-open">Part details</span>
          </span>
        )}
      </summary>
      <div class="part-fields">
        <div class="pair">
          <Field label="Brand" name={name("brand")} value={line.brand} errors={errors} placeholder="e.g. Michelin" />
          <Field
            label="Spec"
            name={name("spec")}
            value={line.spec}
            errors={errors}
            placeholder="205/55 R16, NS60"
            autocapitalize="characters"
          />
        </div>
        <details class="part-position" open={line.position !== "" || name("position") in errors}>
          <summary>+ Position</summary>
          <label class={name("position") in errors ? "field invalid" : "field"}>
            <span>Position</span>
            <select name={name("position")} id={fieldId(name("position"))}>
              <option value="">Not specified</option>
              {positions.map((p) => (
                <option value={p} selected={line.position === p}>
                  {p}
                </option>
              ))}
            </select>
            <FieldError name={name("position")} errors={errors} />
          </label>
        </details>
        <div class="warranty">
          <Field label="Warranty until" name={name("warranty_until")} value={line.warranty_until} errors={errors} type="date" />
          <div class="warranty-picks" data-warranty-picks hidden>
            {WARRANTY_MONTHS.map((m) => (
              <button type="button" class="chip" data-months={String(m)}>
                {m} months
              </button>
            ))}
            <button type="button" class="chip" data-no-warranty>
              No warranty
            </button>
          </div>
        </div>
      </div>
    </details>
  );
}

function LineRow({
  line,
  n,
  items,
  ownCategories,
  errors,
  unread,
  positions,
  today,
}: {
  line: LineValues;
  n: number | "__N__";
  items: ServiceItem[];
  ownCategories: readonly string[];
  errors: FormErrors;
  unread: Set<string>;
  positions: readonly string[];
  today: string;
}) {
  const name = (f: string) => `line.${n}.${f}`;
  return (
    <div class="item">
      <Field label="Work or part" name={name("description")} value={line.description} errors={errors} />
      <Field
        label="Cost (RM)"
        name={name("cost")}
        value={line.cost}
        errors={errors}
        inputmode="decimal"
        highlight={unread.has(name("cost"))}
      />
      <div class="pair">
        <label class={name("category") in errors ? "field invalid" : "field"}>
          <span>Category</span>
          <select name={name("category")} id={fieldId(name("category"))}>
            <option value="">No category</option>
            {[...CATEGORIES, ...ownCategories].map((c) => (
              <option value={c} selected={line.category === c}>
                {c}
              </option>
            ))}
            <option value={NEW_CATEGORY} selected={line.category === NEW_CATEGORY}>
              New category…
            </option>
          </select>
          <FieldError name={name("category")} errors={errors} />
        </label>
        <label class="field">
          <span>Resets reminder</span>
          <select name={name("item")}>
            <option value="">No reminder</option>
            {items.map((i) => (
              <option value={String(i.id)} selected={line.item === String(i.id)} data-category={itemCategory(i.name) ?? undefined}>
                {i.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      {/* Shown (by app.css) only while the picker is on New category…, so it works without app.js. */}
      <div class="new-category">
        <Field
          label="New category name"
          name={name("new_category")}
          value={line.new_category}
          errors={errors}
          placeholder="e.g. Dashcam"
          maxlength={MAX_CATEGORY_NAME}
        />
      </div>
      <PartDetailsFields line={line} name={name} positions={positions} errors={errors} today={today} />
      {/* The empty line at the end is never saved, so there's nothing to remove; "Add line" rows get one. */}
      {(n === "__N__" || !isBlankRow(line)) && (
        <label class="remove">
          <input
            type="checkbox"
            name={name("remove")}
            value="1"
            data-remove-line
            aria-label={line.description ? `Remove this line: ${line.description}` : undefined}
          />{" "}
          Remove this line
        </label>
      )}
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
      <PhotoCapture
        title={receiptKey ? "Replace photo" : "Add a receipt photo"}
        note={receiptKey ? "Take or choose a new one" : "Optional · take or choose one"}
        errors={errors}
      />
    </fieldset>
  );
}

/**
 * The Odometer field with a hint from the vehicle's other readings for the form's date. The page
 * carries the hint for every date range, and public/app.js swaps it in as the Date field changes.
 */
function OdometerField({
  value,
  date,
  readings,
  errors,
  highlight,
}: {
  value: string;
  date: string;
  readings: HintReading[];
  errors: FormErrors;
  highlight: boolean;
}) {
  const hint = odometerHint(readings, parseDateInput(date));
  return (
    <div>
      <Field
        label="Odometer (km)"
        name="odometer_km"
        value={value}
        errors={errors}
        inputmode="numeric"
        required
        highlight={highlight}
        hint={hint ? "odometer-hint" : undefined}
      />
      {hint && (
        <p class="field-hint" id="odometer-hint" data-odometer-hints={JSON.stringify(odometerHintLookup(readings))}>
          {hint}
        </p>
      )}
    </div>
  );
}

export type ServiceFormMode = { kind: "new" } | { kind: "edit"; serviceId: number };

export function ServiceForm({
  vehicle,
  items,
  ownCategories,
  values,
  mode,
  errors = {},
  saved = false,
  receiptKey = null,
  unread = [],
  notice,
  today,
  readings,
}: {
  vehicle: Vehicle;
  items: ServiceItem[];
  /** The owner's own category names, offered after the built-in ones. */
  ownCategories: readonly string[];
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
  /** For telling a warranty that's still running from one that has expired. */
  today: string;
  /** The vehicle's Odometer readings for the hint, without the edited Service's own. */
  readings: HintReading[];
}) {
  const v = values.service;
  const unreadFields = new Set(unread);
  const isNew = mode.kind === "new";
  return (
    <Layout title={isNew ? "Log a service" : "Edit service"} signedIn>
      <p class="crumb">
        <a href={`/vehicles/${vehicle.id}`}>
          <BackIcon />
          {vehicle.name}
        </a>
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
        data-busy="Saving…"
      >
        {isNew && <input type="hidden" name="vehicle_id" value={String(vehicle.id)} />}
        <ReceiptPhoto receiptKey={receiptKey} errors={errors} />
        <fieldset>
          <legend>Visit</legend>
          <div class="pair">
            <Field label="Date" name="date" type="date" value={v.date} errors={errors} required highlight={unreadFields.has("date")} />
            <OdometerField
              value={v.odometer_km}
              date={v.date}
              readings={readings}
              errors={errors}
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
        <fieldset id={fieldId("lines")} tabindex={-1}>
          <legend>Lines</legend>
          <p class="hint">Pick a reminder for a line to restart its countdown. Anything else, like a gasket, stays on No reminder. A category files the line so you can find it later, reminder or not; a line with a reminder takes its category unless you pick another.</p>
          <FieldError name="lines" errors={errors} />
          <RepeatableRows
            id="lines"
            rows={values.lines}
            blank={blankLine}
            addLabel="Add line"
            render={(line, n) => (
              <LineRow
                line={line}
                n={n}
                items={items}
                ownCategories={ownCategories}
                errors={errors}
                unread={unreadFields}
                positions={positionsFor(vehicle.type)}
                today={today}
              />
            )}
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
