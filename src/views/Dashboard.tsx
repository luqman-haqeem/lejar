import type { Vehicle } from "../db";
import { fmtDate } from "../lib/dates";
import { type ExpiryStatus, type ItemDue, type OdometerState, STALE_ODOMETER_DAYS } from "../lib/due";
import { fmtKm } from "../lib/km";
import { vehicleSummary } from "../lib/templates";
import { GaugeIcon, StatusIcon } from "./icons";
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
        <StatusIcon status={item.status} />
        {dueText(item)} · add odometer
      </a>
    );
  }
  const missing = item.lastDate === null && item.lastKm === null ? "" : item.lastKm === null ? " km" : " date";
  return (
    <a class="due-when" href={`/vehicles/${vehicleId}/edit#item-${item.itemId}`}>
      <StatusIcon status={item.status} />
      Set last done{missing}
    </a>
  );
}

function DueRow({ vehicleId, item }: { vehicleId: number; item: ItemDue }) {
  return (
    <li class={`due s-${item.status}`}>
      <span class="due-name">{item.name}</span>
      {item.needs ? (
        <FixLink vehicleId={vehicleId} item={item} />
      ) : (
        <span class="due-when">
          <StatusIcon status={item.status} />
          {dueText(item)}
        </span>
      )}
    </li>
  );
}

const EXPIRY_STATUS: Record<ExpiryStatus["status"], "overdue" | "soon" | "ok" | "unknown"> = {
  overdue: "overdue",
  soon: "soon",
  ok: "ok",
  unset: "unknown",
};

function expiryText(e: ExpiryStatus): string {
  switch (e.status) {
    case "unset":
      return "Not set";
    case "overdue":
      return `Expired ${fmtDate(e.date)}`;
    case "soon":
      return `in ${days(e.daysLeft)}`;
    case "ok":
      return fmtDate(e.date);
  }
}

/** Road tax or insurance as a schedule row; an unset date links to where it's entered. */
function RenewalRow({ vehicleId, label, expiry }: { vehicleId: number; label: string; expiry: ExpiryStatus }) {
  const status = EXPIRY_STATUS[expiry.status];
  const when = (
    <>
      <StatusIcon status={status} />
      {expiryText(expiry)}
    </>
  );
  return (
    <li class={`renewal s-${status}`}>
      <span class="due-name">{label}</span>
      {expiry.status === "unset" ? (
        <a class="due-when" href={`/vehicles/${vehicleId}/edit`}>
          {when}
        </a>
      ) : (
        <span class="due-when">{when}</span>
      )}
    </li>
  );
}

const ODOMETER_PROMPT: Record<OdometerState, string | null> = {
  none: "Add an odometer reading to track km",
  stale: `Update odometer · last reading ${STALE_ODOMETER_DAYS}+ days ago`,
  fresh: null,
};

/**
 * A vehicle's ruled schedule: items most urgent first (optionally only the top few), then road tax and
 * insurance, then an odometer prompt when the km estimate needs a fresh reading.
 */
export function ScheduleList({ due, limit }: { due: VehicleDue; limit?: number }) {
  const v = due.vehicle;
  const shown = limit === undefined ? due.items : due.items.slice(0, limit);
  const more = due.items.length - shown.length;
  const prompt = ODOMETER_PROMPT[due.odometer];
  return (
    <>
      <ul class="due-list">
        {shown.map((item) => (
          <DueRow vehicleId={v.id} item={item} />
        ))}
      </ul>
      {more > 0 && (
        <a class="more" href={`/vehicles/${v.id}#schedule`}>
          {more} more on the schedule
        </a>
      )}
      <ul class="due-list renewals">
        <RenewalRow vehicleId={v.id} label="Road tax" expiry={due.roadtax} />
        <RenewalRow vehicleId={v.id} label={v.insurer ? `Insurance · ${v.insurer}` : "Insurance"} expiry={due.insurance} />
      </ul>
      {prompt && (
        <a class="prompt" href={`/vehicles/${v.id}#odometer`}>
          <GaugeIcon />
          {prompt}
        </a>
      )}
    </>
  );
}

/** A vehicle's navy booklet cover: name, plate and what it is. Links to its history. */
export function Cover({ vehicle, estKm, href }: { vehicle: Vehicle; estKm?: number | null; href?: string }) {
  const body = (
    <>
      <span class="cover-text">
        <span class="cover-name">{vehicle.name}</span>
        <span class="cover-sub">
          {vehicleSummary(vehicle)}
          {estKm != null && <span class="est-km"> · ~{fmtKm(estKm)}</span>}
        </span>
      </span>
      {vehicle.plate && <span class="plate">{vehicle.plate}</span>}
    </>
  );
  return href ? (
    <a class="cover" href={href}>
      {body}
    </a>
  ) : (
    <div class="cover">{body}</div>
  );
}

function VehicleCard({ due }: { due: VehicleDue }) {
  const v = due.vehicle;
  return (
    <article class="book" aria-label={v.name}>
      <h2 class="visually-hidden">{v.name}</h2>
      <Cover vehicle={v} estKm={due.estKm} href={`/vehicles/${v.id}`} />
      <div class="book-page">
        <ScheduleList due={due} limit={TOP_ITEMS} />
      </div>
    </article>
  );
}

export function Dashboard({ vehicles, archivedCount }: { vehicles: VehicleDue[]; archivedCount: number }) {
  if (vehicles.length === 0) {
    return (
      <Layout title="Dashboard" signedIn tab="home">
        <section class="empty">
          <h1>No vehicles yet</h1>
          <p>Add a car or motorbike to start tracking its services, road tax and insurance.</p>
          <a class="button" href="/vehicles/new">
            Add your first vehicle
          </a>
          {archivedCount > 0 && (
            <p class="archived-link">
              <a href="/vehicles/archived">Archived vehicles ({archivedCount})</a>
            </p>
          )}
        </section>
      </Layout>
    );
  }
  return (
    <Layout title="Dashboard" signedIn tab="home">
      <h1 class="visually-hidden">Your vehicles</h1>
      {vehicles.map((due) => (
        <VehicleCard due={due} />
      ))}
    </Layout>
  );
}
