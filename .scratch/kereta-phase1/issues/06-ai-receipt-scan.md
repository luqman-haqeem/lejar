# 06: Scan a receipt to prefill a service

**What to build:** From the dashboard, the user picks a vehicle, then takes or chooses a receipt photo. An OpenRouter vision model reads it, and the service form opens prefilled with date, odometer, workshop, total and line items, each line already linked to a suggested schedule item. Anything the AI couldn't read is left blank and highlighted. Nothing is saved until the user presses Save. If reading fails, the form still opens with the photo attached.

**Blocked by:** 05

**Status:** done

- [x] The model comes from config (default `google/gemini-2.5-flash`) and the request asks for structured JSON. The request times out after about 25 seconds.
- [x] RM strings and numbers with commas are parsed into sen and km. A date that's invalid or in the future is dropped and shown as unread.
- [x] An OpenRouter error, a timeout or a non-JSON reply opens an empty form with the photo attached and the banner "Couldn't read receipt — fill in manually". It never returns a 500.
- [x] Line items are matched to schedule items by keyword, in English and Malay. For example, "minyak hitam" or "fully synthetic" maps to Engine oil, and "penapis minyak" maps to Oil filter. The more specific match wins, so "oil filter" beats "engine oil". Lines with no match are left unlinked.
- [x] Old receipts work: the date comes from the receipt, not today.
- [x] Scanning against another user's vehicle gets 404.
- [x] OpenRouter is called through an injectable fetch, so tests never hit the real API.
- [ ] Tests and the typecheck pass. Also do a manual check with one real workshop receipt.

## Comments

- 2026-11-18 (implementation): The last box stays unticked until a real receipt is scanned with a real `OPENROUTER_API_KEY` in `.dev.vars` (`npx wrangler dev`, open /scan).
- Scan posts to `POST /scan` (the plan's `/api/scan`); it renders the service form, which saves through the normal `POST /services`.
- The data URL uses the uploaded photo's real type, so a PNG/WebP fallback upload is sent correctly.
- The daily scan cap is ticket 07: it goes in `POST /scan` after the photo checks and before `putReceipt`.
