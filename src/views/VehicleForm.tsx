import type { FormErrors } from "../form";
import { ErrorSummary, Field, FieldError, type FieldProps, fieldId, RepeatableRows } from "./fields";
import type { DetailValues, FormValues, ItemValues } from "../vehicle-form";
import { isVehicleType, VEHICLE_TYPE_LABELS } from "../lib/templates";
import { BackIcon } from "./icons";
import { Layout } from "./Layout";

export type AddFrom = "home" | "profile" | "scan";
export const isAddFrom = (v: unknown): v is AddFrom => v === "home" || v === "profile" || v === "scan";

const blankItem: ItemValues = { id: "", name: "", km: "", months: "", baseline_date: "", baseline_km: "", remove: "" };

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
              <input
                type="radio"
                name="type"
                value={value}
                id={i === 0 ? fieldId("type") : undefined}
                checked={d.type ? d.type === value : i === 0}
              />{" "}
              {label}
            </label>
          ))}
          <FieldError name="type" errors={errors} />
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
    <div class="item" id={item.id ? `item-${item.id}` : undefined}>
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
  return (
    <fieldset class="schedule" id={fieldId("items")} tabindex={-1}>
      <legend>Service schedule</legend>
      <p class="hint">
        Whichever comes first, km or months, makes an item due. If you know roughly when an item was last done, fill
        in "last done" so the app can work out when it's next due.
      </p>
      <FieldError name="items" errors={errors} />
      <RepeatableRows
        id="items"
        rows={items}
        blank={blankItem}
        addLabel="Add item"
        render={(item, n) => <ItemRow item={item} n={n} errors={errors} />}
      />
    </fieldset>
  );
}

export function NewVehicle({
  values,
  errors = {},
  from = "profile",
}: {
  values: DetailValues;
  errors?: FormErrors;
  /**
   * Where the user came from: Home's first-vehicle button, Profile, or the Scan tab with no vehicle yet
   * (which goes on to Scan once the vehicle is added).
   */
  from?: AddFrom;
}) {
  const home = from !== "profile";
  return (
    <Layout title="Add vehicle" signedIn tab={from === "scan" ? "scan" : undefined}>
      <p class="crumb">
        <a href={home ? "/" : "/profile"}>
          <BackIcon />
          {home ? "Home" : "Profile"}
        </a>
      </p>
      <h1>Add a vehicle</h1>
      {from === "scan" && <p class="notice">Add the vehicle first, then scan its receipt.</p>}
      <ErrorSummary errors={errors} />
      <form method="post" action="/vehicles" class="vehicle-form">
        {from !== "profile" && <input type="hidden" name="from" value={from} />}
        <Details d={values} errors={errors} />
        <p class="hint">It starts with a typical service schedule for its type. You can adjust it any time.</p>
        <button type="submit" class="button">
          {from === "scan" ? "Add and scan receipt" : "Add vehicle"}
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
      <p class="crumb">
        <a href={`/vehicles/${id}`}>
          <BackIcon />
          {values.details.name || "Vehicle"}
        </a>
      </p>
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
      {archived ? (
        <form method="post" action={`/vehicles/${id}/restore`} class="archive">
          <button type="submit" class="secondary">
            Restore to dashboard
          </button>
        </form>
      ) : (
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
