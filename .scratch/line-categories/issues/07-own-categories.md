# 07: Your own categories

**What to build:** Besides the built-in list, an owner can create their own categories (e.g. "Dashcam", "Accessories") while logging a service line, and use them exactly like built-in ones on all their vehicles, including the vehicle history filter and print history. They can rename or delete their own categories, but can't delete one that lines still use.

**Blocked by:** 02

**Status:** ready-for-agent

Parent: 01-line-categories

Decisions (2026-11-23):
- Own categories belong to the owner and are shared across all their vehicles.
- They're created from a "New category…" choice in the service line's Category picker, while logging.
- They can be renamed and deleted. Renaming updates every line that uses it. Deleting a category that any line still uses is refused with an error saying how many lines use it; the owner must move those lines to another category (or none) first.
- Rename and delete live in a "My categories" list on the profile page (the line picker only creates).

- [ ] Choosing "New category…" on a line's Category picker lets the owner type a name; saving the service creates the category and sets it on that line.
- [ ] Blank names, and names that duplicate an existing category (case-insensitive, including built-in names), are rejected with a field error on the service form, keeping what was typed.
- [ ] Own categories appear in every line's Category choice, on every one of the owner's vehicles, after the built-in ones.
- [ ] Own categories appear in the vehicle history filter (05) and print history (06) wherever those have landed.
- [ ] The profile page lists the owner's own categories with how many lines use each.
- [ ] Renaming a category changes it on every line that uses it; renaming to a blank or duplicate name shows an error and changes nothing.
- [ ] Deleting a category no line uses removes it.
- [ ] Deleting a category that lines still use is refused with an error naming how many lines use it, and nothing is deleted.
- [ ] Built-in categories can't be renamed or deleted.
- [ ] Another user never sees, uses, renames or deletes someone else's categories (a foreign id returns not found).
- [ ] Receipt scans never suggest own categories (only built-in ones).
- [ ] Tests cover create from the line picker, duplicate rejection, rename, delete unused, delete refused while in use, and scoping between users.
