import type { ServiceWithLines, Vehicle } from "../db";
import { fmtDate } from "../lib/dates";
import { fmtKm } from "../lib/km";
import { fmtOptionalRM, fmtRM } from "../lib/money";
import { vehicleSummary } from "../lib/templates";
import { Layout } from "./Layout";

/**
 * A vehicle's full service history for printing or saving as a PDF (e.g. for a buyer). Shows only
 * logged services: schedule baselines are estimates and never appear here, and the owner's private
 * notes are left out.
 */
export function PrintHistory({
  vehicle,
  services,
  today,
}: {
  vehicle: Vehicle;
  services: ServiceWithLines[];
  today: string;
}) {
  const grandTotal = services.reduce((sum, s) => sum + s.total_sen, 0);
  return (
    <Layout title={`${vehicle.name} service history`} stylesheet="/print.css">
      <div class="print-actions no-print">
        <a href={`/vehicles/${vehicle.id}`}>← Back</a>
        <button type="button" class="button no-print" data-print>Print / Save as PDF</button>
      </div>
      <header class="print-head">
        <div>
          <h1>{vehicle.name}</h1>
          <p>{vehicleSummary(vehicle)}</p>
        </div>
        <div class="print-meta">
          {vehicle.plate && <span class="plate">{vehicle.plate}</span>}
          <p>Generated {fmtDate(today)}</p>
        </div>
      </header>
      <h2>Service history</h2>
      {services.length === 0 ? (
        <p>No services logged.</p>
      ) : (
        <>
          {services.map((s) => (
            <section class="print-service">
              <div class="print-service-head">
                <strong>{fmtDate(s.date)}</strong>
                <span>{fmtKm(s.odometer_km)}</span>
                <span>{s.workshop}</span>
                <strong class="amount">{fmtRM(s.total_sen)}</strong>
              </div>
              {s.lines.length > 0 && (
                <table class="print-lines">
                  <tbody>
                    {s.lines.map((l) => (
                      <tr>
                        <td>{l.description}</td>
                        <td class="amount">{fmtOptionalRM(l.cost_sen)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          ))}
          <p class="print-total">
            <span>
              Grand total ({services.length} {services.length === 1 ? "service" : "services"})
            </span>
            <strong class="amount">{fmtRM(grandTotal)}</strong>
          </p>
        </>
      )}
      <script src="/app.js" defer></script>
    </Layout>
  );
}
