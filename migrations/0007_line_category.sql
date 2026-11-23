-- Category on a service line (see GLOSSARY.md): one of src/lib/categories.ts, or NULL for none.
-- Existing lines keep NULL: no backfill.
ALTER TABLE service_lines ADD COLUMN category TEXT;
