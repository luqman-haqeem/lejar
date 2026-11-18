import { Layout } from "./Layout";

/** Plain-English privacy policy. Public: Google requires it to open sign-in to everyone. */
export function Privacy({ contactEmail }: { contactEmail: string }) {
  return (
    <Layout title="Privacy">
      <article class="prose">
        <p class="crumb">
          <a href="/login">← Kereta</a>
        </p>
        <h1>Privacy</h1>
        <p>Kereta is a personal vehicle service book. This page explains what it keeps about you and why.</p>

        <h2>What's stored</h2>
        <ul>
          <li>
            Your <strong>Google email</strong> and Google account id, from signing in. Kereta asks Google for nothing
            else: not your name, contacts or files.
          </li>
          <li>
            The <strong>vehicles</strong> you add: name, plate, make, model, year, road tax and insurance dates, and
            your service schedule.
          </li>
          <li>
            The <strong>services</strong> you log: dates, odometer readings, workshops, costs, line items and notes.
          </li>
          <li>
            <strong>Receipt photos</strong> you attach or scan, stored privately. Only you can see them.
          </li>
          <li>A sign-in cookie that keeps you signed in for 30 days, and a count of your receipt scans per day.</li>
        </ul>

        <h2>Receipt scanning</h2>
        <p>
          When you use <strong>Scan receipt</strong>, the photo is sent to <strong>OpenRouter</strong>, which passes it
          to an AI model to read the date, odometer, workshop and amounts. Nothing is saved until you check the details
          and press Save. Photos you attach without scanning are not sent anywhere.
        </p>

        <h2>Who sees your data</h2>
        <p>
          Only you. Your data is <strong>never sold or shared</strong>, there are no ads and no tracking. It's stored
          on Cloudflare, which hosts the app.
        </p>

        <h2>Deleting your data</h2>
        <p>
          You can delete any service or receipt photo yourself. To delete your whole account and everything in it,
          email <a href={`mailto:${contactEmail}?subject=Kereta%20account%20deletion`}>{contactEmail}</a> from the
          Google address you sign in with.
        </p>

        <h2>Questions</h2>
        <p>
          Email <a href={`mailto:${contactEmail}`}>{contactEmail}</a>.
        </p>
      </article>
    </Layout>
  );
}
