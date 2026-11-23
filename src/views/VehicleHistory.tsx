import type { CategoryLine, Reading, Service, Vehicle, YearTotal } from "../db";
import type { FormErrors } from "../form";
import { fmtDate } from "../lib/dates";
import { fmtKm } from "../lib/km";
import { fmtOptionalRM, fmtRM } from "../lib/money";
import { hasPartDetails, partSummary } from "../lib/parts";
import { ErrorSummary, Field } from "./fields";
import { Cover, ScheduleList, type VehicleDue } from "./Dashboard";
import { BackIcon } from "./icons";
import { Layout } from "./Layout";

export type ReadingValues = { date: string; km: string };

export function VehicleHistory({
  vehicle,
  due,
  services,
  totals,
  manualReadings,
  reading,
  errors = {},
  stamped = null,
  added = false,
  categories,
  filter,
  today,
}: {
  vehicle: Vehicle;
  /** What's due on this vehicle, for its full schedule. */
  due: VehicleDue;
  services: Service[];
  totals: YearTotal[];
  /** Newest first. */
  manualReadings: Reading[];
  reading: ReadingValues;
  errors?: FormErrors;
  /** A visit just saved: its stamp is struck as the page opens. */
  stamped?: number | null;
  /** Just added: confirm it, since this is where Add vehicle lands. */
  added?: boolean;
  /** The categories this vehicle's lines use, to filter the history by. */
  categories: readonly string[];
  /** The chosen category and its lines, newest first; null shows the whole history. */
  filter: { category: string; lines: CategoryLine[] } | null;
  today: string;
}) {
  const justStamped = stamped !== null && services.some((s) => s.id === stamped);
  return (
    <Layout title={vehicle.name} signedIn>
      <p class="crumb">
        <a href="/">
          <BackIcon />
          Home
        </a>
      </p>
      <h1 class="visually-hidden">{vehicle.name}</h1>
      <Cover vehicle={vehicle} estKm={due.estKm} />
      {added && (
        <p class="notice" role="status">
          {vehicle.name} added.
        </p>
      )}
      {due.started ? (
        <>
          <div class="actions">
            <a class="button" href={`/scan?vehicle=${vehicle.id}`}>
              Scan receipt
            </a>
            <a class="secondary" href={`/services/new?vehicle=${vehicle.id}`}>
              Log by hand
            </a>
          </div>
          <div class="actions quiet-actions">
            <a class="text-link" href={`/vehicles/${vehicle.id}/edit`}>
              Edit details &amp; schedule
            </a>
            <a class="text-link" href={`/vehicles/${vehicle.id}/print`}>
              Print / PDF
            </a>
          </div>
        </>
      ) : (
        <section class="start" aria-labelledby="start-title">
          <h2 id="start-title">Start with the last service</h2>
          <p>
            Scan the receipt from {vehicle.name}'s last workshop visit. Its date, km and the work done set when engine
            oil, filters and the rest are next due.
          </p>
          <div class="actions">
            <a class="button" href={`/scan?vehicle=${vehicle.id}`}>
              Scan receipt
            </a>
            <a class="secondary" href={`/services/new?vehicle=${vehicle.id}`}>
              Log by hand
            </a>
          </div>
          <a class="text-link" href={`/vehicles/${vehicle.id}/edit`}>
            No receipt? Set last-done dates yourself
          </a>
        </section>
      )}

      {justStamped && (
        <p class="notice" role="status">
          Saved. <a href="#history">See it stamped in the history</a>
        </p>
      )}

      <section id="schedule" class="schedule-section">
        <h2>Schedule</h2>
        <div class="book-page ruled">
          <ScheduleList due={due} />
        </div>
      </section>

      <section id="history">
        <h2>History</h2>
        {categories.length > 0 && <CategoryFilter vehicleId={vehicle.id} categories={categories} chosen={filter?.category ?? null} />}
        {filter ? (
          <CategoryLines lines={filter.lines} today={today} />
        ) : services.length === 0 ? (
          <div class="stamp-blank">
            <span class="stamp-blank-title">First stamp goes here</span>
            <span>Each logged visit is stamped in this history. Old paper receipts can be backdated.</span>
          </div>
        ) : (
          <ol class="stamps">
            {services.map((s) => (
              <li>
                <a class={s.id === stamped ? "stamp stamp-new" : "stamp"} href={`/services/${s.id}`}>
                  <span class="stamp-date">{fmtDate(s.date)}</span>
                  <span class="stamp-shop">{s.workshop || "Service"}</span>
                  <span class="stamp-figures">
                    <span>{fmtKm(s.odometer_km)}</span>
                    <span>{fmtRM(s.total_sen)}</span>
                  </span>
                </a>
              </li>
            ))}
          </ol>
        )}
      </section>

      {totals.length > 0 && (
        <section>
          <h2>Spent per year</h2>
          <dl class="totals">
            {totals.map((t) => (
              <div>
                <dt>{t.year}</dt>
                <dd>{fmtRM(t.total_sen)}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      <section id="odometer">
        <h2>Add odometer reading</h2>
        <ErrorSummary errors={errors} />
        <form method="post" action={`/vehicles/${vehicle.id}/readings`} class="vehicle-form">
          <div class="pair">
            <Field label="Date" name="date" type="date" value={reading.date} errors={errors} required />
            <Field label="Odometer (km)" name="km" value={reading.km} errors={errors} inputmode="numeric" required />
          </div>
          <button type="submit" class="secondary">
            Save reading
          </button>
        </form>
        {manualReadings.length > 0 && (
          <ul class="lines readings">
            {manualReadings.map((r) => (
              <li>
                <span>
                  {fmtDate(r.date)} · {fmtKm(r.km)}
                </span>
                <form method="post" action={`/readings/${r.id}/delete`} data-confirm="Delete this reading?">
                  <button type="submit" class="link danger">
                    Delete
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
      <script src="/app.js" defer></script>
    </Layout>
  );
}

/** All, then each category the vehicle's lines use: links, so a filtered view can be bookmarked. */
function CategoryFilter({
  vehicleId,
  categories,
  chosen,
}: {
  vehicleId: number;
  categories: readonly string[];
  chosen: string | null;
}) {
  const link = (href: string, label: string, current: boolean) => (
    <a href={href} aria-current={current ? "page" : undefined}>
      {label}
    </a>
  );
  return (
    <nav class="category-filter" aria-label="Filter the history by category">
      {link(`/vehicles/${vehicleId}#history`, "All", chosen === null)}
      {categories.map((cat) => link(`/vehicles/${vehicleId}?category=${encodeURIComponent(cat)}#history`, cat, cat === chosen))}
    </nav>
  );
}

/** One category's lines across services: the line, its part details and its Service, linking to it. */
function CategoryLines({ lines, today }: { lines: CategoryLine[]; today: string }) {
  return (
    <ul class="lines category-lines">
      {lines.map((l) => (
        <li>
          <span>
            <a href={`/services/${l.service_id}`}>{l.description}</a>
            {hasPartDetails(l) && <span class="part-details">{partSummary(l, today)}</span>}
            <span class="line-service">
              {[fmtDate(l.date), fmtKm(l.odometer_km), l.workshop].filter(Boolean).join(" · ")}
            </span>
          </span>
          <span>{fmtOptionalRM(l.cost_sen)}</span>
        </li>
      ))}
    </ul>
  );
}
