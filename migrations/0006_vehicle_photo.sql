-- The one photo an owner chooses for a vehicle: an R2 key under vehicle-photos/<user_id>/.
ALTER TABLE vehicles ADD COLUMN photo_key TEXT;
