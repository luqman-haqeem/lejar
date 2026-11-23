-- An owner's own categories (see GLOSSARY.md), shared across all their vehicles. A line stores its
-- category by name, built-in or own, so renaming one also rewrites the owner's lines that use it.
-- Names are unique per owner ignoring case; clashes with the built-in list are refused by the app.
CREATE TABLE categories (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users (id),
  name TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX categories_by_user ON categories (user_id, name COLLATE NOCASE);
