-- TVETtrack Database Schema
-- PostgreSQL 15+
-- Run: psql -U postgres -d tvettrack -f schema.sql

-- ─── EXTENSIONS ──────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── USERS ───────────────────────────────────────────────────────────────────
CREATE TABLE users (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  email       TEXT NOT NULL UNIQUE,
  password    TEXT NOT NULL,  -- bcrypt hash
  role        TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin','user','editor')),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── CLIENTS MASTER ──────────────────────────────────────────────────────────
CREATE TABLE clients (
  id           SERIAL PRIMARY KEY,
  full_name    TEXT NOT NULL,
  short_name   TEXT NOT NULL,
  type         TEXT NOT NULL CHECK (type IN ('Government','NGO','INGO','Association','Private Limited','Public Limited','Other')),
  address      TEXT,
  remarks      TEXT,
  is_active    BOOLEAN DEFAULT TRUE,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ─── CTEVT OCCUPATIONS MASTER ────────────────────────────────────────────────
CREATE TABLE occupations (
  id           SERIAL PRIMARY KEY,
  name         TEXT NOT NULL,
  sector       TEXT NOT NULL,
  duration     INTEGER,  -- hours, nullable (some have no fixed duration)
  is_custom    BOOLEAN DEFAULT FALSE,  -- true = added by admin, false = pre-loaded
  is_active    BOOLEAN DEFAULT TRUE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ─── INSTITUTES ──────────────────────────────────────────────────────────────
CREATE TABLE institutes (
  id                    SERIAL PRIMARY KEY,
  name                  TEXT NOT NULL,
  acronym               TEXT,
  reg_no                TEXT NOT NULL,
  reg_date              TEXT,
  pan                   TEXT,
  permanent_account_no  TEXT,
  contact_person        TEXT,
  phone                 TEXT,
  email                 TEXT,
  address               TEXT,
  type                  TEXT CHECK (type IN ('Private','Government','NGO','INGO')),
  status                TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active','Pending Renewal','Expired')),
  renewal_due           TEXT,
  remarks               TEXT,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- ─── EXPERIENCE / ASSIGNMENTS ────────────────────────────────────────────────
CREATE TABLE assignments (
  id               SERIAL PRIMARY KEY,
  institute_id     INTEGER NOT NULL REFERENCES institutes(id) ON DELETE CASCADE,
  client_id        INTEGER REFERENCES clients(id) ON DELETE SET NULL,
  client_name_manual TEXT,  -- used when client is not in the clients table
  fiscal_year      TEXT NOT NULL,
  assignment_name  TEXT NOT NULL,
  training_type    TEXT,
  contract_amount  BIGINT,  -- NPR
  start_date       TEXT,
  end_date         TEXT,
  remarks          TEXT,
  reference_file   TEXT,    -- base64 or Cloudinary URL
  reference_file_name TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE assignment_occupations (
  id                      SERIAL PRIMARY KEY,
  assignment_id           INTEGER NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  name_in_letter          TEXT NOT NULL,
  ctevt_occupation_id     INTEGER REFERENCES occupations(id) ON DELETE SET NULL,
  trainees                INTEGER,
  duration_hours          INTEGER,
  skill_test_provisioned  BOOLEAN DEFAULT FALSE,
  skill_test_appeared     INTEGER,
  skill_test_pass         INTEGER,
  employment_provisioned  BOOLEAN DEFAULT FALSE,
  employment_actual_pct   NUMERIC(5,2),
  sort_order              INTEGER DEFAULT 0
);

CREATE TABLE assignment_locations (
  id              SERIAL PRIMARY KEY,
  assignment_id   INTEGER NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  province        TEXT NOT NULL,
  district        TEXT NOT NULL,
  local_level     TEXT NOT NULL,
  local_level_type TEXT,
  sort_order      INTEGER DEFAULT 0
);

-- ─── NSTB SKILL TEST RECORDS ─────────────────────────────────────────────────
CREATE TABLE nstb_records (
  id             SERIAL PRIMARY KEY,
  institute_id   INTEGER NOT NULL REFERENCES institutes(id) ON DELETE CASCADE,
  fiscal_year    TEXT NOT NULL,
  occupation     TEXT NOT NULL,
  level          TEXT NOT NULL CHECK (level IN ('Level 1','Level 2','Level 3','Professional')),
  applied        INTEGER NOT NULL,
  appeared       INTEGER NOT NULL,
  pass           INTEGER NOT NULL,
  letter_no      TEXT,
  letter_date    TEXT,
  letter_type    TEXT CHECK (letter_type IN ('Annual','Consolidated')),
  remarks        TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ─── TAX CLEARANCE ───────────────────────────────────────────────────────────
CREATE TABLE tax_clearances (
  id                      SERIAL PRIMARY KEY,
  institute_id            INTEGER NOT NULL REFERENCES institutes(id) ON DELETE CASCADE,
  fiscal_year             TEXT NOT NULL,
  turnover                BIGINT NOT NULL,     -- NPR
  taxable_income          BIGINT NOT NULL,     -- NPR
  tax_paid                BIGINT NOT NULL,     -- NPR
  cert_date               TEXT,
  kar_chuta_no            TEXT,
  patra_no                TEXT,
  income_statement_date   TEXT,
  remarks                 TEXT,
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (institute_id, fiscal_year)
);

-- ─── CTEVT AFFILIATION ───────────────────────────────────────────────────────
CREATE TABLE affiliations (
  id                SERIAL PRIMARY KEY,
  institute_id      INTEGER NOT NULL REFERENCES institutes(id) ON DELETE CASCADE,
  patra_no          TEXT,
  chalani_no        TEXT,
  affiliation_date  TEXT NOT NULL,
  type              TEXT CHECK (type IN ('Sambandhan/Swikruti','Thap Choto Awadhi','Renewal')),
  validity_years    INTEGER DEFAULT 2,
  expiry_date       TEXT,
  status            TEXT CHECK (status IN ('Active','Expired','Pending Renewal')),
  remarks           TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE affiliation_programs (
  id              SERIAL PRIMARY KEY,
  affiliation_id  INTEGER NOT NULL REFERENCES affiliations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  level           TEXT CHECK (level IN ('Level 1','Level 2','Professional')),
  duration_hours  INTEGER,
  seats_per_batch INTEGER,
  sort_order      INTEGER DEFAULT 0
);

-- ─── ASSIGNMENT TEMPLATES ────────────────────────────────────────────────────
CREATE TABLE assignment_templates (
  id          SERIAL PRIMARY KEY,
  user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  name        TEXT NOT NULL,
  data        JSONB NOT NULL,  -- stores template structure as JSON
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── INDEXES ─────────────────────────────────────────────────────────────────
CREATE INDEX idx_assignments_institute ON assignments(institute_id);
CREATE INDEX idx_assignments_fy ON assignments(fiscal_year);
CREATE INDEX idx_assignments_client ON assignments(client_id);
CREATE INDEX idx_nstb_institute ON nstb_records(institute_id);
CREATE INDEX idx_nstb_fy ON nstb_records(fiscal_year);
CREATE INDEX idx_tax_institute ON tax_clearances(institute_id);
CREATE INDEX idx_affiliations_institute ON affiliations(institute_id);
CREATE INDEX idx_institutes_status ON institutes(status);

-- ─── UPDATED_AT TRIGGER ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_clients_updated BEFORE UPDATE ON clients FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_institutes_updated BEFORE UPDATE ON institutes FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_assignments_updated BEFORE UPDATE ON assignments FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_nstb_updated BEFORE UPDATE ON nstb_records FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_tax_updated BEFORE UPDATE ON tax_clearances FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_affiliations_updated BEFORE UPDATE ON affiliations FOR EACH ROW EXECUTE FUNCTION set_updated_at();
