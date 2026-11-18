import type { ServiceItem, ServiceWithLines, Vehicle } from "../db";
import { fmtDate } from "../lib/dates";
import { fmtKm } from "../lib/km";
import { fmtRM } from "../lib/money";
import { Layout } from "./Layout";

export function ServiceView({ vehicle, service, items }: { vehicle: Vehicle; service: ServiceWithLines; items: ServiceItem[] }) {
  const itemName = new Map(items.map((i) => [i.id, i.name]));
  return (
    <Layout title={`Service ${fmtDate(service.date)}`} signedIn>
      <p class="crumb">
        <a href={`/vehicles/${vehicle.id}`}>← {vehicle.name}</a>
      </p>
      <h1>{service.workshop || "Service"}</h1>
      <dl class="facts">
        <div>
          <dt>Date</dt>
          <dd>{fmtDate(service.date)}</dd>
        </div>
        <div>
          <dt>Odometer</dt>
          <dd>{fmtKm(service.odometer_km)}</dd>
        </div>
        <div>
          <dt>Total</dt>
          <dd>{fmtRM(service.total_sen)}</dd>
        </div>
      </dl>
      {service.notes && <p class="notes">{service.notes}</p>}
      {service.lines.length > 0 && (
        <ul class="lines">
          {service.lines.map((l) => (
            <li>
              <span>
                {l.description}
                {l.service_item_id !== null && itemName.has(l.service_item_id) && (
                  <span class="tag">{itemName.get(l.service_item_id)}</span>
                )}
              </span>
              <span>{l.cost_sen === null ? "" : fmtRM(l.cost_sen)}</span>
            </li>
          ))}
        </ul>
      )}
      <div class="actions">
        <a class="button" href={`/services/${service.id}/edit`}>
          Edit
        </a>
      </div>
      <form
        method="post"
        action={`/services/${service.id}/delete`}
        class="archive"
        data-confirm="Delete this service? This can't be undone."
      >
        <button type="submit" class="link danger">
          Delete service
        </button>
      </form>
      <script src="/app.js" defer></script>
    </Layout>
  );
}
