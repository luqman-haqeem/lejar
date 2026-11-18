import type { Vehicle } from "../db";
import { fmtDate } from "../lib/dates";
import { type ExpiryStatus, type ItemDue, type OdometerState, STALE_ODOMETER_DAYS } from "../lib/due";
import { fmtKm } from "../lib/km";
import { VEHICLE_TYPE_LABELS } from "../lib/templates";
import { Layout } from "./Layout";

export type VehicleDue = {
  vehicle: Vehicle;
  estKm: number | null;
  odometer: OdometerState;
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

/** What an unknown item is missing, as a link to where the user can add it. */
function FixLink({ vehicleId, item }: { vehicleId: number; item: ItemDue }) {
  if (item.needs === "reading") {
    return (
      <a class="due-when" href={`/vehicles/${vehicleId}#odometer`}>
        {dueText(item)} · add odometer
      </a>
    );
  }
  const missing = item.lastDate === null && item.lastKm === null ? "" : item.lastKm === null ? " km" : " date";
  return (
    <a class="due-when" href={`/vehicles/${vehicleId}/edit#item-${item.itemId}`}>
      Set last done{missing}
    </a>
  );
}

function DueRow({ vehicleId, item }: { vehicleId: number; item: ItemDue }) {
  return (
    <li class={`due s-${item.status}`}>
      <span class="due-name">{item.name}</span>
      {item.needs ? <FixLink vehicleId={vehicleId} item={item} /> : <span class="due-when">{dueText(item)}</span>}
    </li>
  );
}

const EXPIRY_CLASS: Record<ExpiryStatus["status"], string> = { overdue: "overdue", soon: "soon", ok: "ok", unset: "unknown" };

function expiryText(label: string, e: ExpiryStatus): string {
  switch (e.status) {
    case "unset":
      return `${label} not set`;
    case "overdue":
      return `${label} expired ${fmtDate(e.date)}`;
    case "soon":
      return `${label} in ${days(e.daysLeft)}`;
    case "ok":
      return `${label} ${fmtDate(e.date)}`;
  }
}

function ExpiryChip({ label, expiry, extra }: { label: string; expiry: ExpiryStatus; extra?: string }) {
  const text = expiryText(label, expiry);
  return <span class={`chip s-${EXPIRY_CLASS[expiry.status]}`}>{extra && expiry.date ? `${text} · ${extra}` : text}</span>;
}

const ODOMETER_PROMPT: Record<OdometerState, string | null> = {
  none: "Add an odometer reading to track km",
  stale: `Update odometer: last reading over ${STALE_ODOMETER_DAYS} days ago`,
  fresh: null,
};

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
      {ODOMETER_PROMPT[due.odometer] && (
        <a class="prompt" href={`/vehicles/${v.id}#odometer`}>
          {ODOMETER_PROMPT[due.odometer]}
        </a>
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
        <ExpiryChip label="Road tax" expiry={due.roadtax} />
        <ExpiryChip label="Insurance" expiry={due.insurance} extra={v.insurer || undefined} />
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
