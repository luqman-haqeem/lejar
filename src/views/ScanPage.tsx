import type { Vehicle } from "../db";
import { Layout } from "./Layout";

export function ScanPage({
  vehicles,
  selected,
  error,
  left,
}: {
  vehicles: Vehicle[];
  selected: number | null;
  error?: string;
  /** AI scans the user has left today. */
  left: number;
}) {
  const only = vehicles.length === 1 ? vehicles[0] : null;
  const manual = `/services/new?vehicle=${selected ?? vehicles[0].id}`;
  if (left === 0) {
    return (
      <Layout title="Scan receipt" signedIn>
        <p class="crumb">
          <a href="/">← Dashboard</a>
        </p>
        <section class="empty">
          <h1>Daily scan limit reached — you can still log manually</h1>
          <p>Scans reset at midnight (Malaysia time). Logging by hand is never limited.</p>
          <a class="button" href={manual}>
            Log a service by hand
          </a>
        </section>
      </Layout>
    );
  }
  return (
    <Layout title="Scan receipt" signedIn>
      <p class="crumb">
        <a href="/">← Dashboard</a>
      </p>
      <h1>Scan a receipt</h1>
      <p>Take a photo of the workshop receipt, or choose one. You'll check the details before anything is saved.</p>
      <p class="muted">{left === 1 ? "1 scan left today" : `${left} scans left today`}</p>
      {error && (
        <p class="error" role="alert">
          {error}
        </p>
      )}
      <form
        method="post"
        action="/scan"
        enctype="multipart/form-data"
        class="vehicle-form"
        data-busy="Reading receipt…"
      >
        {only ? (
          <input type="hidden" name="vehicle" value={String(only.id)} />
        ) : (
          <label class="field">
            <span>Vehicle</span>
            <select name="vehicle">
              {vehicles.map((v) => (
                <option value={String(v.id)} selected={v.id === selected}>
                  {v.name}
                  {v.plate ? ` (${v.plate})` : ""}
                </option>
              ))}
            </select>
          </label>
        )}
        <label class="field">
          <span>Receipt photo</span>
          <input type="file" name="photo" accept="image/*" required data-compress />
        </label>
        <button type="submit" class="button">
          Read receipt
        </button>
      </form>
      <p class="hint">
        Or <a href={manual}>log a service by hand</a>.
      </p>
      <script src="/app.js" defer></script>
    </Layout>
  );
}
