import type { FormErrors } from "../form";
import { ErrorSummary, Field, FieldError, type FieldProps, fieldId, RepeatableRows } from "./fields";
import type { DetailValues, FormValues, ItemValues } from "../vehicle-form";
import { COMMON_MODELS, EXAMPLES, QUICK_PICKS } from "../lib/common-vehicles";
import { isVehicleType, VEHICLE_TYPE_LABELS, type VehicleType } from "../lib/templates";
import { BackIcon } from "./icons";
import { PhotoCapture } from "./capture";
import { vehiclePhotoUrl } from "../receipts";
import { Layout } from "./Layout";

export type AddFrom = "home" | "profile" | "scan";
export const isAddFrom = (v: unknown): v is AddFrom => v === "home" || v === "profile" || v === "scan";

const blankItem: ItemValues = { id: "", name: "", km: "", months: "", baseline_date: "", baseline_km: "", remove: "" };

function Suggestions() {
  return (
    <>
      {Object.entries(COMMON_MODELS).map(([type, makes]) => (
        <>
          <datalist id={`makes-${type}`}>
            {Object.keys(makes).map((make) => (
              <option value={make} />
            ))}
          </datalist>
          <datalist id={`models-${type}`}>
            {Object.entries(makes).flatMap(([make, models]) => models.map((model) => <option value={model} data-make={make} />))}
          </datalist>
        </>
      ))}
    </>
  );
}

/** One tap fills make, model and name. Needs public/app.js, so hidden until it runs. */
function QuickPicks({ type }: { type: VehicleType }) {
  return (
    <div class="picks" data-picks hidden>
      <span class="picks-label" id="picks-label">
        Common models
      </span>
      {Object.entries(QUICK_PICKS).map(([t, picks]) => (
        // biome-ignore lint/a11y/useSemanticElements: styled row of buttons, a fieldset would change layout
        <div class="pick-row" role="group" aria-labelledby="picks-label" data-type={t} hidden={t !== type}>
          {picks.map((p) => (
            <button
              type="button"
              class="pick"
              data-make={p.make}
              data-model={p.model}
              aria-label={`${p.make} ${p.model}`}
              aria-pressed="false"
            >
              {p.model}
            </button>
          ))}
        </div>
      ))}
      <p class="hint picks-hint">Not listed? Type the make and model below.</p>
    </div>
  );
}

function Details({ d, errors, typeFixed = false, picks = false }: { d: DetailValues; errors: FormErrors; typeFixed?: boolean; picks?: boolean }) {
  const type: VehicleType = isVehicleType(d.type) ? d.type : "car";
  const eg = EXAMPLES[type];
  // Ticked when both dates match, including both blank, so a new vehicle starts with one date to fill in.
  const sameDay = d.insurance_expiry === d.roadtax_expiry;
  return (
    <>
      <fieldset class="details" data-examples={JSON.stringify(EXAMPLES)}>
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
                  checked={type === value}
                />{" "}
                {label}
              </label>
            ))}
            <FieldError name="type" errors={errors} />
          </div>
        )}
        {picks && <QuickPicks type={type} />}
        <Suggestions />
        <div class="pair">
          <Field label="Make" name="make" value={d.make} errors={errors} placeholder={`e.g. ${eg.make}`} list={`makes-${type}`} autocomplete="off" />
          <Field label="Model" name="model" value={d.model} errors={errors} placeholder={`e.g. ${eg.model}`} list={`models-${type}`} autocomplete="off" />
        </div>
        <div class="pair">
          <Field label="Plate" name="plate" value={d.plate} errors={errors} placeholder={`e.g. ${eg.plate}`} autocapitalize="characters" />
          <Field label="Year" name="year" value={d.year} errors={errors} placeholder="e.g. 2019" inputmode="numeric" />
        </div>
        <Field label="Name" name="name" value={d.name} errors={errors} placeholder={`e.g. ${eg.name}`} hint="name-hint" />
        <p class="field-hint" id="name-hint">
          What you call it on Home. Leave blank to use the model.
        </p>
      </fieldset>
      <fieldset class="renewals">
        <legend>Road tax and insurance</legend>
        <p class="hint">Road tax expiry is in the MyJPJ app. Insurance expiry is on your cover note.</p>
        <Field label="Road tax expiry" name="roadtax_expiry" type="date" value={d.roadtax_expiry} errors={errors} />
        <label class="same-day">
          <input type="checkbox" name="insurance_same" value="1" checked={sameDay} /> Insurance expires on the same day
        </label>
        <div class="insurance-date">
          <Field label="Insurance expiry" name="insurance_expiry" type="date" value={d.insurance_expiry} errors={errors} />
        </div>
        <Field label="Insurer" name="insurer" value={d.insurer} errors={errors} placeholder="e.g. Etiqa" />
      </fieldset>
    </>
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

/** The optional Vehicle photo: the current one (with Remove) and a picker to add or replace it. */
function VehiclePhoto({ photoKey, errors }: { photoKey: string | null; errors: FormErrors }) {
  return (
    <fieldset class="vehicle-photo-field">
      <legend>Photo</legend>
      {photoKey && (
        <div class="vehicle-photo-current">
          <img class="vehicle-photo" src={vehiclePhotoUrl(photoKey)} alt="Current photo" />
          <label class="remove">
            <input type="checkbox" name="remove_photo" value="1" /> Remove this photo
          </label>
        </div>
      )}
      <PhotoCapture
        title={photoKey ? "Replace photo" : "Add a photo"}
        note={photoKey ? "Take or choose a new one" : "Optional · shows on its cover"}
        errors={errors}
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
      <form method="post" action="/vehicles" enctype="multipart/form-data" class="vehicle-form" data-busy="Adding…">
        {from !== "profile" && <input type="hidden" name="from" value={from} />}
        <Details d={values} errors={errors} picks />
        <VehiclePhoto photoKey={null} errors={errors} />
        <p class="hint">It starts with a typical service schedule for its type. You can adjust it any time.</p>
        <button type="submit" class="button">
          {from === "scan" ? "Add and scan receipt" : "Add vehicle"}
        </button>
      </form>
      <script src="/app.js" defer></script>
    </Layout>
  );
}

export function EditVehicle({
  id,
  values,
  archived,
  errors = {},
  saved = false,
  photoKey,
}: {
  id: number;
  values: FormValues;
  archived: boolean;
  photoKey: string | null;
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
      <form method="post" action={`/vehicles/${id}`} enctype="multipart/form-data" class="vehicle-form" data-busy="Saving…">
        <Details d={values.details} errors={errors} typeFixed />
        <VehiclePhoto photoKey={photoKey} errors={errors} />
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
