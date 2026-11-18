# 07: Daily scan cap

**What to build:** To keep the OpenRouter bill bounded now that anyone can sign up, AI scans are limited to 20 per user per day (Malaysia date) and 300 per day across all users. The scan page shows how many scans are left today. Once the limit is reached, the user is pointed to manual entry, which is never limited.

**Blocked by:** 06

**Status:** done

- [x] Both limits are config values: `SCAN_CAP_PER_USER` = 20 and `SCAN_CAP_GLOBAL` = 300.
- [x] A scan counts when it's attempted, even if the AI then fails. Uploads rejected for size or type don't count.
- [x] The counter increments atomically, so two scans fired at the same moment can't both slip past the limit.
- [x] Over the limit, the response is 429 with "Daily scan limit reached — you can still log manually" and a link to the manual form. Nothing is uploaded and OpenRouter isn't called.
- [x] The count resets the next Malaysia day. One user hitting their limit doesn't affect other users, unless the overall limit is reached.
- [x] Tests and the typecheck pass.
