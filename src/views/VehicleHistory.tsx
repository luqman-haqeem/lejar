import type { Reading, Service, Vehicle, YearTotal } from "../db";
import type { FormErrors } from "../form";
import { fmtDate } from "../lib/dates";
import { fmtKm } from "../lib/km";
import { fmtRM } from "../lib/money";
import { ErrorSummary, Field } from "./fields";
import { Layout } from "./Layout";

export type ReadingValues = { date: string; km: string };

export function VehicleHistory({
  vehicle,
  services,
  totals,
  manualReadings,
  reading,
  errors = {},
}: {
  vehicle: Vehicle;
  services: Service[];
  totals: YearTotal[];
  /** Newest first. */
  manualReadings: Reading[];
  reading: ReadingValues;
  errors?: FormErrors;
}) {
  return (
    <Layout title={vehicle.name} signedIn>
      <div class="page-head">
        <h1>{vehicle.name}</h1>
        {vehicle.plate && <span class="plate">{vehicle.plate}</span>}
      </div>
      <div class="actions">
        <a class="button" href={`/services/new?vehicle=${vehicle.id}`}>
          Log a service
        </a>
        <a class="secondary" href={`/scan?vehicle=${vehicle.id}`}>
          Scan receipt
        </a>
        <a class="secondary" href={`/vehicles/${vehicle.id}/print`}>
          Print / PDF
        </a>
        <a class="secondary" href={`/vehicles/${vehicle.id}/edit`}>
          Details &amp; schedule
        </a>
      </div>

      <section>
        <h2>History</h2>
        {services.length === 0 ? (
          <p>No services logged yet. Old paper records can be backdated.</p>
        ) : (
          <ul class="history">
            {services.map((s) => (
              <li>
                <a href={`/services/${s.id}`}>
                  <span class="when">{fmtDate(s.date)}</span>
                  <span class="what">
                    {s.workshop || "Service"}
                    <span class="muted"> · {fmtKm(s.odometer_km)}</span>
                  </span>
                  <span class="cost">{fmtRM(s.total_sen)}</span>
                </a>
              </li>
            ))}
          </ul>
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
