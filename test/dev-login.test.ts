import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/index";
import { cookieValue } from "./fake-google";

const app = createApp();
const devEnv = { ...env, DEV_LOGIN: "1" };
const signIn = (url: string, e: Cloudflare.Env) => app.request(url, { method: "POST" }, e);

describe("local dev sign-in", () => {
  it("signs in as a local user on localhost when DEV_LOGIN is set", async () => {
    const res = await signIn("http://localhost:8787/auth/dev", devEnv);
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/");
    const session = cookieValue(res, "kereta_session");
    expect(session).toBeTruthy();

    const home = await app.request("http://localhost:8787/", { headers: { cookie: `kereta_session=${session}` } }, devEnv);
    expect(home.status).toBe(200);
  });

  it("also works on 127.0.0.1", async () => {
    expect((await signIn("http://127.0.0.1:8787/auth/dev", devEnv)).status).toBe(302);
  });

  it("doesn't exist without DEV_LOGIN, even on localhost", async () => {
    const res = await signIn("http://localhost:8787/auth/dev", { ...env, DEV_LOGIN: "" });
    expect(res.status).toBe(404);
    expect(res.headers.getSetCookie()).toEqual([]);
  });

  it("doesn't exist on any other host, even with DEV_LOGIN", async () => {
    for (const url of ["https://kereta.example.workers.dev/auth/dev", "http://localhost.evil.com/auth/dev"]) {
      const res = await signIn(url, devEnv);
      expect(res.status).toBe(404);
      expect(res.headers.getSetCookie()).toEqual([]);
    }
  });

  it("is offered on the sign-in page only when it would work", async () => {
    const page = async (url: string, e: Cloudflare.Env) => (await app.request(url, {}, e)).text();
    expect(await page("http://localhost:8787/login", devEnv)).toContain('action="/auth/dev"');
    expect(await page("http://localhost:8787/login", { ...env, DEV_LOGIN: "" })).not.toContain('action="/auth/dev"');
    expect(await page("https://kereta.example.workers.dev/login", devEnv)).not.toContain('action="/auth/dev"');
  });
});
