import type { Vehicle } from "../db";
import { fmtDate } from "../lib/dates";
import type { ExpiryStatus, ItemDue } from "../lib/due";
import { fmtKm } from "../lib/km";
import { VEHICLE_TYPE_LABELS } from "../lib/templates";
import { Layout } from "./Layout";

export type VehicleDue = {
  vehicle: Vehicle;
  estKm: number | null;
  hasReadings: boolean;
  stale: boolean;
  /** Most urgent first. */
  items: ItemDue[];
  roadtax: ExpiryStatus;
  insurance: ExpiryStatus;
};

/** How many schedule items each card shows. */
const TOP_ITEMS = 3;

const days = (n: number) => (n === 1 ? "1 day" : `${n} days`);

/** "in 500 km · in 12 days", "300 km overdue · 17 days overdue", "today". */
function dueText(i: ItemDue): string {
  const parts: string[] = [];
  if (i.kmLeft !== null) parts.push(i.kmLeft > 0 ? `in ${fmtKm(i.kmLeft)}` : `${fmtKm(-i.kmLeft)} overdue`);
  else if (i.dueKm !== null) parts.push(`at ${fmtKm(i.dueKm)}`);
  if (i.daysLeft !== null) {
    parts.push(i.daysLeft === 0 ? "today" : i.daysLeft > 0 ? `in ${days(i.daysLeft)}` : `${days(-i.daysLeft)} overdue`);
  }
  return parts.join(" · ");
}

function DueRow({ vehicleId, item }: { vehicleId: number; item: ItemDue }) {
  const neverDone = item.lastDate === null && item.lastKm === null;
  return (
    <li class={`due s-${item.status}`}>
      <span class="due-name">{item.name}</span>
      {neverDone ? (
        <a class="due-when" href={`/vehicles/${vehicleId}/edit#item-${item.itemId}`}>
          Set last done
        </a>
      ) : (
        <span class="due-when">{dueText(item)}</span>
      )}
    </li>
  );
}

function ExpiryChip({ label, date, expiry, extra }: { label: string; date: string | null; expiry: ExpiryStatus; extra?: string }) {
  const { status, daysLeft } = expiry;
  const text =
    status === "unset" || date === null || daysLeft === null
      ? `${label} not set`
      : status === "overdue"
        ? `${label} expired ${fmtDate(date)}`
        : status === "soon"
          ? `${label} in ${days(daysLeft)}`
          : `${label} ${fmtDate(date)}`;
  const cls = status === "unset" ? "unknown" : status;
  return <span class={`chip s-${cls}`}>{extra && status !== "unset" ? `${text} · ${extra}` : text}</span>;
}

function VehicleCard({ due }: { due: VehicleDue }) {
  const v = due.vehicle;
  const subtitle = [VEHICLE_TYPE_LABELS[v.type], [v.make, v.model, v.year].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(" · ");
  const more = due.items.length - TOP_ITEMS;
  return (
    <article class="card">
      <a class="card-head" href={`/vehicles/${v.id}`}>
        <h2>{v.name}</h2>
        {v.plate && <span class="plate">{v.plate}</span>}
      </a>
      <p class="muted">
        {subtitle}
        {due.estKm !== null && <span class="est-km"> · ~{fmtKm(due.estKm)}</span>}
      </p>
      {!due.hasReadings ? (
        <a class="prompt" href={`/vehicles/${v.id}#odometer`}>
          Add an odometer reading to track km
        </a>
      ) : (
        due.stale && (
          <a class="prompt" href={`/vehicles/${v.id}#odometer`}>
            Update odometer: last reading over 30 days ago
          </a>
        )
      )}
      <ul class="due-list">
        {due.items.slice(0, TOP_ITEMS).map((item) => (
          <DueRow vehicleId={v.id} item={item} />
        ))}
      </ul>
      {more > 0 && (
        <a class="more" href={`/vehicles/${v.id}/edit`}>
          {more} more on the schedule
        </a>
      )}
      <div class="chips">
        <ExpiryChip label="Road tax" date={v.roadtax_expiry} expiry={due.roadtax} />
        <ExpiryChip label="Insurance" date={v.insurance_expiry} expiry={due.insurance} extra={v.insurer || undefined} />
      </div>
    </article>
  );
}

export function Dashboard({ vehicles }: { vehicles: VehicleDue[] }) {
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
      {vehicles.map((due) => (
        <VehicleCard due={due} />
      ))}
    </Layout>
  );
}
