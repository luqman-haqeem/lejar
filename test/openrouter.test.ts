import { describe, expect, it } from "vitest";
import { scanReceipt } from "../src/openrouter";

const TODAY = "2026-11-18";
const config = { apiKey: "test-key", model: "google/gemini-2.5-flash" };
const image = { bytes: new Uint8Array([0xff, 0xd8, 0xff, 0xd9]), contentType: "image/jpeg" };

/** A fake OpenRouter that records requests and answers with the given message content. */
function fakeOpenRouter(content: string, status = 200) {
  const requests: Request[] = [];
  const fetchFn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    requests.push(new Request(input, init));
    if (status !== 200) return new Response("upstream error", { status });
    return Response.json({ choices: [{ message: { role: "assistant", content } }] });
  }) as typeof fetch;
  return { fetchFn, requests };
}

describe("asking the model to read a receipt", () => {
  it("sends the photo as structured-output chat to the configured model", async () => {
    const { fetchFn, requests } = fakeOpenRouter(JSON.stringify({ date: "2026-09-02", total: 85, lines: [] }));
    const result = await scanReceipt({ ...image, contentType: "image/png" }, config, TODAY, fetchFn);
    expect(result).toMatchObject({ date: "2026-09-02", total_sen: 8500 });

    const [req] = requests;
    expect(req.url).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect(req.method).toBe("POST");
    expect(req.headers.get("authorization")).toBe("Bearer test-key");
    const body = (await req.json()) as any;
    expect(body.model).toBe("google/gemini-2.5-flash");
    expect(body.response_format.type).toBe("json_schema");
    expect(Object.keys(body.response_format.json_schema.schema.properties).sort()).toEqual(
      ["date", "lines", "odometer_km", "total", "workshop"],
    );
    const parts = body.messages[0].content;
    const imagePart = parts.find((p: any) => p.type === "image_url");
    expect(imagePart.image_url.url).toBe("data:image/png;base64,/9j/2Q==");
  });

  it("gives null, never throwing, when the call fails, times out or returns junk", async () => {
    const throwing = (async () => {
      throw new DOMException("The operation was aborted due to timeout", "TimeoutError");
    }) as typeof fetch;
    expect(await scanReceipt(image, config, TODAY, throwing)).toBeNull();
    expect(await scanReceipt(image, config, TODAY, fakeOpenRouter("{}", 500).fetchFn)).toBeNull();
    expect(await scanReceipt(image, config, TODAY, fakeOpenRouter("Sorry, I can't read that.").fetchFn)).toBeNull();
    const noChoices = (async () => Response.json({ error: { message: "rate limited" } })) as typeof fetch;
    expect(await scanReceipt(image, config, TODAY, noChoices)).toBeNull();
    const notJson = (async () => new Response("<html>gateway</html>")) as typeof fetch;
    expect(await scanReceipt(image, config, TODAY, notJson)).toBeNull();
  });
});
