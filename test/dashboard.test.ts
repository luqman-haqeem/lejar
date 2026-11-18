import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/index";
import { cookieValue } from "./fake-google";
import { makeUser, sessionHeaders } from "./helpers";

const app = createApp();

describe("empty dashboard", () => {
  it("invites a new user to add their first vehicle", async () => {
    const res = await app.request("/", { headers: await sessionHeaders(await makeUser()) }, env);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Add your first vehicle");
    expect(html).toContain('href="/vehicles/new"');
  });
});

describe("signing out", () => {
  it("clears the session and returns to sign-in", async () => {
    const headers = await sessionHeaders(await makeUser());
    const res = await app.request("/logout", { method: "POST", headers }, env);

    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/login");
    const cleared = res.headers.getSetCookie().find((c) => c.startsWith("kereta_session="))!;
    expect(cleared).toContain("Max-Age=0");
    expect(cookieValue(res, "kereta_session")).toBe("");
  });

  it("offers a sign-out button on the dashboard", async () => {
    const res = await app.request("/", { headers: await sessionHeaders(await makeUser()) }, env);
    const html = await res.text();
    expect(html).toMatch(/<form[^>]*method="post"[^>]*action="\/logout"|<form[^>]*action="\/logout"[^>]*method="post"/);
  });
});
