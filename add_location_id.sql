ALTER TABLE sale_items ADD COLUMN location_id INTEGER REFERENCES locations(id);
