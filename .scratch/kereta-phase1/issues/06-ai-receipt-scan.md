# 06: Scan a receipt to prefill a service

**What to build:** From the dashboard, the user picks a vehicle, then takes or chooses a receipt photo. An OpenRouter vision model reads it, and the service form opens prefilled with date, odometer, workshop, total and line items, each line already linked to a suggested schedule item. Anything the AI couldn't read is left blank and highlighted. Nothing is saved until the user presses Save. If reading fails, the form still opens with the photo attached.

**Blocked by:** 05

**Status:** ready-for-agent

- [ ] The model comes from config (default `google/gemini-2.5-flash`) and the request asks for structured JSON. The request times out after about 25 seconds.
- [ ] RM strings and numbers with commas are parsed into sen and km. A date that's invalid or in the future is dropped and shown as unread.
- [ ] An OpenRouter error, a timeout or a non-JSON reply opens an empty form with the photo attached and the banner "Couldn't read receipt — fill in manually". It never returns a 500.
- [ ] Line items are matched to schedule items by keyword, in English and Malay. For example, "minyak hitam" or "fully synthetic" maps to Engine oil, and "penapis minyak" maps to Oil filter. The more specific match wins, so "oil filter" beats "engine oil". Lines with no match are left unlinked.
- [ ] Old receipts work: the date comes from the receipt, not today.
- [ ] Scanning against another user's vehicle gets 404.
- [ ] OpenRouter is called through an injectable fetch, so tests never hit the real API.
- [ ] Tests and the typecheck pass. Also do a manual check with one real workshop receipt.
