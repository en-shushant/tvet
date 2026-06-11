-- TVETtrack Seed Data
-- Run after schema.sql: psql -U postgres -d tvettrack -f seed.sql

-- ─── CLIENTS ─────────────────────────────────────────────────────────────────
INSERT INTO clients (full_name, short_name, type, address) VALUES
  ('Rural Enterprises and Remittances Project', 'SAMRIDDHI', 'Government', 'Itahari, Sunsari'),
  ('Social Safeguard and Environmental Management Department, NEA', 'NEA SSEMD', 'Government', 'Matatirtha, Kathmandu'),
  ('Enhanced Vocational Education and Training Project - Second', 'EVENT-II', 'Government', 'Buddhanagar, Kathmandu'),
  ('Foreign Employment Board', 'FEB', 'Government', 'Kathmandu'),
  ('Province Council for Technical and Vocational Education and Training, Bagamati', 'PCTVET Bagamati', 'Government', 'Hetauda, Makwanpur'),
  ('Rastriya Byabasayik Prashikshan Pratisthan Bikas Samiti', 'NAVT/VSDTA', 'Government', 'Bhaisepati, Lalitpur'),
  ('Micro, Cottage and Small Industries Promotion Centre', 'MCSIPC', 'Government', 'Tripureshwar, Kathmandu'),
  ('Kohalpur Nagarpalika Employment Service Center', 'Kohalpur ESC', 'Government', 'Kohalpur, Banke');

-- ─── OCCUPATIONS (309 total — first 20 shown, rest follow same pattern) ──────
INSERT INTO occupations (name, sector, duration, is_custom) VALUES
  ('Community Livestock Assistant Technician, 2071', 'Agriculture/Forestry - Animal Science', 520, FALSE),
  ('Community Livestock Assistant, Revised 2072', 'Agriculture/Forestry - Animal Science', 422, FALSE),
  ('Dairy Product/Sweets Maker, 2008', 'Agriculture/Forestry - Animal Science', 550, FALSE),
  ('Village Animal Health Worker, Revised 2069', 'Agriculture/Forestry - Animal Science', 390, FALSE),
  ('Assistant Beautician, 2015', 'Beauty and Cosmetology', 390, FALSE),
  ('Beautician, 2071', 'Beauty and Cosmetology', 670, FALSE),
  ('Junior Beautician, 2077', 'Beauty and Cosmetology', 180, FALSE),
  ('Assistant Barber, 2013', 'Beauty and Cosmetology', 390, FALSE),
  ('Building Electrician, 2071', 'Electrical', 520, FALSE),
  ('Junior Building Electrician, Revised 2070', 'Electrical', 390, FALSE),
  ('Industrial Electrician, Revised 2013', 'Electrical', 390, FALSE),
  ('Professional Building Electrician, 2073', 'Professional', 1696, FALSE),
  ('Plumber, 2074', 'Engineering - Civil/Construction', 390, FALSE),
  ('Professional Plumber, 2023', 'Professional', 1696, FALSE),
  ('Tailor, 2071', 'Tailoring, Garment, Textile and Hosiery', 390, FALSE),
  ('Tailor Master, 2008', 'Tailoring, Garment, Textile and Hosiery', 460, FALSE),
  ('General Cook, 2069', 'Tourism/Hospitality', 390, FALSE),
  ('General Cook (Commis II), Revised 2076', 'Tourism/Hospitality', 484, FALSE),
  ('Nepali Cuisine Cook, 2077', 'Tourism/Hospitality', 390, FALSE),
  ('Caregiver (390 hrs)', 'Health', 390, FALSE),
  ('Early Childhood Montessori Facilitator, 2018', 'Education / Pedagogy', 390, FALSE),
  ('Enterprise Development Facilitator, 2071', 'Management and Business Services', 1500, FALSE),
  ('Cell-Mobile Phone Repair Technician, Revised 2077', 'Electronics', 390, FALSE),
  ('Mason, 2074', 'Engineering - Civil/Construction', 390, FALSE),
  ('Light Vehicle Driver, 2008', 'Automobile', 390, FALSE),
  ('Junior Auto Mechanic, Revised 2018', 'Automobile', 390, FALSE),
  ('Housekeeping Cleaner, Revised 2077', 'Tourism/Hospitality', 390, FALSE),
  ('Professional Cook, 2023', 'Professional', 1696, FALSE),
  ('Fast Food Cook, 2070', 'Tourism/Hospitality', 390, FALSE),
  ('Waiter/Waitress, Revised 2072', 'Tourism/Hospitality', 390, FALSE);
-- NOTE: Full 309 occupations should be inserted via the provided occupations_list.md
-- Use: node scripts/seed_occupations.js to insert all 309
