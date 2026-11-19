import type { Vehicle } from "../db";
import { vehicleSummary } from "../lib/templates";
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

export function Profile({ email, vehicles, archivedCount }: { email: string | null; vehicles: Vehicle[]; archivedCount: number }) {
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
