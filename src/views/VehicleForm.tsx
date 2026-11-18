import type { DetailValues, FormErrors, FormValues, ItemValues } from "../vehicle-form";
import { isVehicleType, VEHICLE_TYPE_LABELS } from "../lib/templates";
import { Layout } from "./Layout";

const blankItem: ItemValues = { id: "", name: "", km: "", months: "", baseline_date: "", baseline_km: "", remove: "" };

function ErrorSummary({ errors }: { errors: FormErrors }) {
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

type FieldProps = {
  label: string;
  name: string;
  value: string;
  errors: FormErrors;
  errorKey?: string;
  type?: string;
  inputmode?: "numeric" | "text";
  placeholder?: string;
  required?: boolean;
  autocapitalize?: "characters";
};

function Field({ label, name, value, errors, errorKey = name, type = "text", ...rest }: FieldProps) {
  const invalid = errorKey in errors;
  return (
    <label class={invalid ? "field invalid" : "field"}>
      <span>{label}</span>
      <input name={name} type={type} value={value} aria-invalid={invalid ? "true" : undefined} {...rest} />
    </label>
  );
}

function Details({ d, errors, typeFixed = false }: { d: DetailValues; errors: FormErrors; typeFixed?: boolean }) {
  return (
    <fieldset class="details">
      <legend>Vehicle</legend>
      {typeFixed && isVehicleType(d.type) ? (
        <p class="muted">{VEHICLE_TYPE_LABELS[d.type]}</p>
      ) : (
        <div class={"type" in errors ? "type-choice invalid" : "type-choice"}>
          {Object.entries(VEHICLE_TYPE_LABELS).map(([value, label], i) => (
            <label>
              <input type="radio" name="type" value={value} checked={d.type ? d.type === value : i === 0} /> {label}
            </label>
          ))}
        </div>
      )}
      <Field label="Name" name="name" value={d.name} errors={errors} placeholder="e.g. Myvi" required />
      <Field label="Plate" name="plate" value={d.plate} errors={errors} autocapitalize="characters" />
      <div class="pair">
        <Field label="Make" name="make" value={d.make} errors={errors} />
        <Field label="Model" name="model" value={d.model} errors={errors} />
      </div>
      <Field label="Year" name="year" value={d.year} errors={errors} inputmode="numeric" />
      <div class="pair">
        <Field label="Road tax expiry" name="roadtax_expiry" type="date" value={d.roadtax_expiry} errors={errors} />
        <Field label="Insurance expiry" name="insurance_expiry" type="date" value={d.insurance_expiry} errors={errors} />
      </div>
      <Field label="Insurer" name="insurer" value={d.insurer} errors={errors} />
    </fieldset>
  );
}

function ItemRow({ item, n, errors }: { item: ItemValues; n: number | "__N__"; errors: FormErrors }) {
  const name = (f: string) => `item.${n}.${f}`;
  const field = (label: string, f: keyof ItemValues, extra: Partial<FieldProps> = {}) => (
    <Field label={label} name={name(f)} value={item[f]} errors={errors} {...extra} />
  );
  return (
    <div class="item">
      {item.id && <input type="hidden" name={name("id")} value={item.id} />}
      {field("Item", "name", { placeholder: "e.g. Tyre rotation" })}
      <div class="pair">
        {field("Every (km)", "km", { inputmode: "numeric" })}
        {field("Every (months)", "months", { inputmode: "numeric" })}
      </div>
      <div class="pair">
        {field("Last done (date)", "baseline_date", { type: "date" })}
        {field("Last done (km)", "baseline_km", { inputmode: "numeric" })}
      </div>
      {item.id && (
        <label class="remove">
          <input type="checkbox" name={name("remove")} value="1" checked={item.remove !== ""} /> Remove this item
        </label>
      )}
    </div>
  );
}

function Schedule({ items, errors }: { items: ItemValues[]; errors: FormErrors }) {
  // Without JS there is always one blank row to add an item; "Add item" clones the template for more.
  const last = items.at(-1);
  const endsBlank = last !== undefined && !last.id && Object.values(last).every((v) => v === "");
  const rows = endsBlank ? items : [...items, blankItem];
  return (
    <fieldset class="schedule">
      <legend>Service schedule</legend>
      <p class="hint">
        Whichever comes first, km or months, makes an item due. If you know roughly when an item was last done, fill
        in "last done" so the app can work out when it's next due.
      </p>
      <div id="items" data-next={rows.length}>
        {rows.map((item, n) => (
          <ItemRow item={item} n={n} errors={errors} />
        ))}
      </div>
      <template id="item-template">
        <ItemRow item={blankItem} n="__N__" errors={{}} />
      </template>
      <button type="button" class="secondary" data-add-item hidden>
        Add item
      </button>
    </fieldset>
  );
}

export function NewVehicle({ values, errors = {} }: { values: DetailValues; errors?: FormErrors }) {
  return (
    <Layout title="Add vehicle" signedIn>
      <h1>Add a vehicle</h1>
      <ErrorSummary errors={errors} />
      <form method="post" action="/vehicles" class="vehicle-form">
        <Details d={values} errors={errors} />
        <p class="hint">It starts with a typical service schedule for its type, which you can adjust next.</p>
        <button type="submit" class="button">
          Add vehicle
        </button>
      </form>
    </Layout>
  );
}

export function EditVehicle({
  id,
  values,
  archived,
  errors = {},
  saved = false,
}: {
  id: number;
  values: FormValues;
  archived: boolean;
  errors?: FormErrors;
  saved?: boolean;
}) {
  return (
    <Layout title={values.details.name || "Edit vehicle"} signedIn>
      <h1>{values.details.name || "Edit vehicle"}</h1>
      {archived && <p class="notice">This vehicle is archived and hidden from your dashboard.</p>}
      {saved && (
        <p class="notice" role="status">
          Saved.
        </p>
      )}
      <ErrorSummary errors={errors} />
      <form method="post" action={`/vehicles/${id}`} class="vehicle-form">
        <Details d={values.details} errors={errors} typeFixed />
        <Schedule items={values.items} errors={errors} />
        <button type="submit" class="button">
          Save
        </button>
      </form>
      {!archived && (
        <form
          method="post"
          action={`/vehicles/${id}/archive`}
          class="archive"
          data-confirm="Archive this vehicle? It will disappear from your dashboard."
        >
          <button type="submit" class="link danger">
            Archive vehicle
          </button>
        </form>
      )}
      <script src="/app.js" defer></script>
    </Layout>
  );
}
