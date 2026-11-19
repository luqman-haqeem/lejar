import type { Vehicle } from "../db";
import { BackIcon } from "./icons";
import { Layout } from "./Layout";

export function ArchivedVehicles({ vehicles }: { vehicles: Vehicle[] }) {
  return (
    <Layout title="Archived vehicles" signedIn>
      <p class="crumb">
        <a href="/profile">
          <BackIcon />
          Profile
        </a>
      </p>
      <h1>Archived vehicles</h1>
      {vehicles.length === 0 ? (
        <p>Nothing archived.</p>
      ) : (
        <ul class="lines">
          {vehicles.map((v) => (
            <li>
              <a href={`/vehicles/${v.id}`}>
                {v.name}
                {v.plate && <span class="muted"> · {v.plate}</span>}
              </a>
              <form method="post" action={`/vehicles/${v.id}/restore`}>
                <button type="submit" class="link">
                  Restore
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </Layout>
  );
}
