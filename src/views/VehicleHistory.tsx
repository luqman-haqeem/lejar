import type { Reading, Service, Vehicle, YearTotal } from "../db";
import type { FormErrors } from "../form";
import { fmtDate } from "../lib/dates";
import { fmtKm } from "../lib/km";
import { fmtRM } from "../lib/money";
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
}) {
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

      <section id="schedule" class="schedule-section">
        <h2>Schedule</h2>
        <div class="book-page ruled">
          <ScheduleList due={due} />
        </div>
      </section>

      <section>
        <h2>History</h2>
        {services.length === 0 ? (
          <p>No services logged yet. Old paper records can be backdated.</p>
        ) : (
          <ol class="stamps">
            {services.map((s) => (
              <li>
                <a class="stamp" href={`/services/${s.id}`}>
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
