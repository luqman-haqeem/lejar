import type { Vehicle } from "../db";
import { fmtDate } from "../lib/dates";
import { VEHICLE_TYPE_LABELS } from "../lib/templates";
import { Layout } from "./Layout";

function Renewal({ label, date, extra }: { label: string; date: string | null; extra?: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>
        {date ? fmtDate(date) : "Not set"}
        {extra && <span class="muted"> · {extra}</span>}
      </dd>
    </div>
  );
}

function VehicleCard({ v }: { v: Vehicle }) {
  const subtitle = [v.make, v.model, v.year].filter(Boolean).join(" ");
  return (
    <article class="card">
      <a class="card-head" href={`/vehicles/${v.id}/edit`}>
        <h2>{v.name}</h2>
        {v.plate && <span class="plate">{v.plate}</span>}
      </a>
      <p class="muted">
        {VEHICLE_TYPE_LABELS[v.type]}
        {subtitle && ` · ${subtitle}`}
      </p>
      <dl class="renewals">
        <Renewal label="Road tax" date={v.roadtax_expiry} />
        <Renewal label="Insurance" date={v.insurance_expiry} extra={v.insurer || undefined} />
      </dl>
    </article>
  );
}

export function Dashboard({ vehicles }: { vehicles: Vehicle[] }) {
  if (vehicles.length === 0) {
    return (
      <Layout title="Dashboard" signedIn>
        <section class="empty">
          <h1>No vehicles yet</h1>
          <p>Add a car or motorbike to start tracking its services, road tax and insurance.</p>
          <a class="button" href="/vehicles/new">
            Add your first vehicle
          </a>
        </section>
      </Layout>
    );
  }
  return (
    <Layout title="Dashboard" signedIn>
      <div class="page-head">
        <h1>Your vehicles</h1>
        <a class="button small" href="/vehicles/new">
          Add vehicle
        </a>
      </div>
      {vehicles.map((v) => (
        <VehicleCard v={v} />
      ))}
    </Layout>
  );
}
