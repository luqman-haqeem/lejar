import { SESSION_TTL_MS } from "../session";
import { Layout } from "./Layout";

const SESSION_DAYS = SESSION_TTL_MS / (24 * 60 * 60 * 1000);

/** Plain-English privacy policy. Public: Google requires it to open sign-in to everyone. */
export function Privacy({ contactEmail }: { contactEmail: string }) {
  return (
    <Layout title="Privacy">
      <article class="prose">
        <p class="crumb">
          <a href="/login">← Lejar</a>
        </p>
        <h1>Privacy</h1>
        <p>Lejar is a personal vehicle service book. This page explains what it keeps about you and why.</p>

        <h2>What's stored</h2>
        <ul>
          <li>
            Your <strong>Google email</strong> and Google account id, from signing in. Lejar asks Google for nothing
            else: not your name, contacts or files.
          </li>
          <li>
            The <strong>vehicles</strong> you add: name, plate, make, model, year, road tax and insurance dates,
            insurer, and your service schedule.
          </li>
          <li>
            The <strong>services</strong> you log (dates, odometer readings, workshops, costs, line items and notes)
            and any odometer readings you add.
          </li>
          <li>
            <strong>Receipt photos</strong> you attach or scan, and a <strong>photo of each vehicle</strong> if you add
            one, stored privately. Only you can see them.
          </li>
          <li>
            A sign-in cookie that keeps you signed in for {SESSION_DAYS} days (plus a short-lived one while you sign in
            with Google), and a count of your receipt scans per day.
          </li>
        </ul>

        <h2>Receipt scanning</h2>
        <p>
          When you use <strong>Scan receipt</strong>, the photo is stored and sent to <strong>OpenRouter</strong>, which
          passes it to an AI model to read the date, odometer, workshop, amounts and part details. You check the details before the
          service is saved; if you don't save it, the photo is deleted within about a day. Photos you attach without
          scanning, and vehicle photos, are not sent anywhere.
        </p>

        <h2>Who sees your data</h2>
        <p>
          Only you. Your data is <strong>never sold or shared</strong>, apart from the receipt photos you choose to scan
          being sent to OpenRouter to be read. There are no ads and no tracking. Everything is stored on Cloudflare,
          which hosts the app.
        </p>

        <h2>Deleting your data</h2>
        <p>
          You can delete any service, receipt photo or vehicle photo yourself. To delete your whole account and everything in it,
          email <a href={`mailto:${contactEmail}?subject=Lejar%20account%20deletion`}>{contactEmail}</a> from the
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
