import type { OwnCategory, Vehicle } from "../db";
import type { FormErrors } from "../form";
import { MAX_CATEGORY_NAME } from "../lib/categories";
import { vehicleSummary } from "../lib/templates";
import { errorId, ErrorSummary, FieldError, fieldId } from "./fields";
import { ChevronIcon } from "./icons";
import { Layout } from "./Layout";

const TEXT_SIZES = [
  ["standard", "Standard"],
  ["large", "Large"],
  ["larger", "Larger"],
] as const;

const THEMES = [
  ["system", "Match phone"],
  ["light", "Light"],
  ["dark", "Dark"],
] as const;

/** A row of radio buttons for one appearance preference. public/app.js saves and applies the choice. */
function Choice({ name, legend, options }: { name: string; legend: string; options: readonly (readonly [string, string])[] }) {
  return (
    <fieldset class="segmented">
      <legend>{legend}</legend>
      <div class="segments">
        {options.map(([value, label], i) => (
          <label>
            <input type="radio" name={name} value={value} checked={i === 0} data-pref={name} />
            <span>{label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export const linesLabel = (n: number) => (n === 0 ? "No lines" : n === 1 ? "1 line" : `${n} lines`);

/** A rename that failed, to show again as typed. */
export type FailedRename = { id: number; name: string };

/** The error key for one of the owner's categories on the profile page. */
export const categoryKey = (id: number) => `category.${id}`;

/**
 * The owner's own categories, each a name to edit with Rename and Delete. Built-in categories aren't
 * listed: they can't be changed.
 */
function MyCategories({
  categories,
  errors,
  typed,
}: {
  categories: OwnCategory[];
  errors: FormErrors;
  typed: FailedRename | null;
}) {
  return (
    <section class="sheet" id="categories">
      <h2>My categories</h2>
      <ErrorSummary errors={errors} />
      {categories.length === 0 ? (
        <p class="sheet-note">None yet. Choose New category… on a service line's Category to add your own.</p>
      ) : (
        <ul class="rows">
          {categories.map((cat) => {
            const key = categoryKey(cat.id);
            const invalid = key in errors;
            return (
              <li class="category-row" id={`category-${cat.id}`}>
                <form method="post" action={`/categories/${cat.id}`} class={invalid ? "category-edit invalid" : "category-edit"}>
                  <span class="category-name">
                    <input
                      name="name"
                      id={fieldId(key)}
                      type="text"
                      value={typed?.id === cat.id ? typed.name : cat.name}
                      maxlength={MAX_CATEGORY_NAME}
                      aria-label={`Name of ${cat.name}`}
                      aria-invalid={invalid ? "true" : undefined}
                      aria-describedby={invalid ? errorId(key) : undefined}
                    />
                    <small>{linesLabel(cat.lines)}</small>
                  </span>
                  <button type="submit" class="secondary">
                    Rename
                  </button>
                  <button type="submit" class="secondary danger" formaction={`/categories/${cat.id}/delete`}>
                    Delete
                  </button>
                  <FieldError name={key} errors={errors} />
                </form>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export function Profile({
  email,
  vehicles,
  archivedCount,
  categories,
  errors = {},
  typed = null,
}: {
  email: string | null;
  vehicles: Vehicle[];
  archivedCount: number;
  categories: OwnCategory[];
  errors?: FormErrors;
  typed?: FailedRename | null;
}) {
  return (
    <Layout title="Profile" signedIn tab="profile">
      <header class="page-title">
        <h1>Profile</h1>
        {email && <p class="muted">Signed in as {email}</p>}
      </header>

      <section class="sheet">
        <h2>Vehicles</h2>
        {vehicles.length === 0 ? (
          <p class="sheet-note">No vehicles yet.</p>
        ) : (
          <ul class="rows">
            {vehicles.map((v) => (
              <li class="vehicle-row">
                <a class="row-link" href={`/vehicles/${v.id}`}>
                  <span>
                    <strong>{v.name}</strong>
                    <small>{vehicleSummary(v)}</small>
                  </span>
                  {v.plate && <span class="plate">{v.plate}</span>}
                </a>
                <a class="row-action" href={`/vehicles/${v.id}/edit`}>
                  Edit
                </a>
              </li>
            ))}
          </ul>
        )}
        <div class="sheet-actions">
          <a class="button" href="/vehicles/new">
            Add vehicle
          </a>
          {archivedCount > 0 && (
            <a class="row-link quiet" href="/vehicles/archived">
              <span>Archived vehicles ({archivedCount})</span>
              <ChevronIcon />
            </a>
          )}
        </div>
      </section>

      <MyCategories categories={categories} errors={errors} typed={typed} />

      <section class="sheet" id="appearance">
        <h2>Appearance</h2>
        <Choice name="text-size" legend="Text size" options={TEXT_SIZES} />
        <Choice name="theme" legend="Theme" options={THEMES} />
        <p class="sheet-note">Saved on this phone.</p>
      </section>

      <section class="sheet">
        <h2>Account</h2>
        <ul class="rows">
          <li>
            <a class="row-link" href="/privacy">
              <span>Privacy</span>
              <ChevronIcon />
            </a>
          </li>
        </ul>
        <form method="post" action="/logout" class="sheet-actions">
          <button type="submit" class="secondary danger">
            Sign out
          </button>
        </form>
      </section>
      <script src="/app.js" defer></script>
    </Layout>
  );
}
