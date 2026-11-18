import { Layout } from "./Layout";

export function Dashboard() {
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
