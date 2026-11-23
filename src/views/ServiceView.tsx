import type { ServiceItem, ServiceWithLines, Vehicle } from "../db";
import { fmtDate } from "../lib/dates";
import { fmtServiceKm } from "../lib/km";
import { fmtOptionalRM, fmtRM } from "../lib/money";
import { receiptUrl } from "../receipts";
import { BackIcon } from "./icons";
import { Layout } from "./Layout";
import { hasPartDetails, partSummary } from "../lib/parts";

export function ServiceView({
  vehicle,
  service,
  items,
  today,
}: {
  vehicle: Vehicle;
  service: ServiceWithLines;
  items: ServiceItem[];
  today: string;
}) {
  const itemName = new Map(items.map((i) => [i.id, i.name]));
  return (
    <Layout title={`Service ${fmtDate(service.date)}`} signedIn>
      <p class="crumb">
        <a href={`/vehicles/${vehicle.id}`}>
          <BackIcon />
          {vehicle.name}
        </a>
      </p>
      <h1>{service.workshop || "Service"}</h1>
      <dl class="facts">
        <div>
          <dt>Date</dt>
          <dd>{fmtDate(service.date)}</dd>
        </div>
        <div>
          <dt>Odometer</dt>
          <dd>{fmtServiceKm(service.odometer_km)}</dd>
        </div>
        <div>
          <dt>Total</dt>
          <dd>{fmtRM(service.total_sen)}</dd>
        </div>
      </dl>
      {service.notes && <p class="notes">{service.notes}</p>}
      {service.receipt_key && (
        <a href={receiptUrl(service.receipt_key)}>
          <img class="receipt-img" src={receiptUrl(service.receipt_key)} alt="Receipt photo" />
        </a>
      )}
      {service.lines.length > 0 && (
        <ul class="lines">
          {service.lines.map((l) => (
            <li>
              <span>
                {l.description}
                {l.category && <span class="tag category">{l.category}</span>}
                {l.service_item_id !== null && itemName.has(l.service_item_id) && (
                  <span class="tag">{itemName.get(l.service_item_id)}</span>
                )}
                {hasPartDetails(l) && <span class="part-details">{partSummary(l, today)}</span>}
              </span>
              <span>{fmtOptionalRM(l.cost_sen)}</span>
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
