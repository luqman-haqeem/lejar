-- Part details: optional facts about the part a service line fitted (see GLOSSARY.md).
ALTER TABLE service_lines ADD COLUMN part_brand TEXT;
ALTER TABLE service_lines ADD COLUMN part_spec TEXT;
-- All, Front, Rear, Front left, Front right, Rear left or Rear right.
ALTER TABLE service_lines ADD COLUMN part_position TEXT;
ALTER TABLE service_lines ADD COLUMN warranty_until TEXT;
