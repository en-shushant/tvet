# TVETtrack

A registry and reporting system for TVET (Technical and Vocational Education and Training) institutes in Nepal. Tracks assignments, NSTB skill tests, tax clearances, CTEVT affiliations, and institute profiles — with a live Nepal administrative map.

---

## Live URL

**[https://tvettrack.vercel.app](https://tvettrack.vercel.app)**

Default admin login:
- Email: `admin@tvettrack.np`
- Password: `admin123`

---

## Architecture

```
Browser → Vercel (frontend + /api proxy) → Railway (Express API) → PostgreSQL
```

| Layer | Technology | Host |
|-------|-----------|------|
| Frontend | Single-file React (Babel standalone) | Vercel |
| API Proxy | Vercel rewrites (`/api/*` → Railway) | Vercel |
| Backend | Node.js + Express | Railway |
| Database | PostgreSQL 15 | Railway (managed) |

> **Why Vercel proxy?** Chrome has an HTTP/2 compatibility issue with Railway's reverse proxy (`ERR_HTTP2_PROTOCOL_ERROR`). Routing API calls through Vercel resolves this — the browser talks to Vercel over HTTP/1.1, which forwards to Railway server-side.

---

## Project Structure

```
TVETtrack_Complete/
├── index.html                   # Vercel entry point (copy of TVETtrack.html)
├── TVETtrack.html               # Main single-file React app
├── vercel.json                  # Vercel config — API proxy rewrites
├── proxy.php                    # cPanel PHP proxy (alternative hosting)
├── _redirects                   # Netlify proxy config (legacy)
├── nepal_locations_final.json   # Province/district/local-level data (753 local levels)
│
└── backend/
    ├── server.js                # Express app entry point + startup migrations
    ├── railway.toml             # Railway deployment config
    ├── package.json
    ├── .env                     # Local env vars (not committed)
    ├── middleware/
    │   └── auth.js              # JWT sign/verify, authenticate & requireAdmin
    ├── db/
    │   ├── pool.js              # PostgreSQL connection pool
    │   ├── schema.sql           # Full database schema
    │   └── seed.sql             # Initial seed data
    └── routes/
        ├── auth.js              # POST /login, /register, GET /me
        ├── users.js             # User management (admin only)
        ├── institutes.js        # Institute CRUD + search
        ├── assignments.js       # Assignments with occupations & locations
        ├── nstb.js              # NSTB skill test records
        ├── tax.js               # Tax clearance records
        ├── affiliations.js      # CTEVT affiliation records
        ├── clients.js           # Client/donor master
        ├── occupations.js       # CTEVT occupation master + custom
        ├── templates.js         # Assignment templates
        └── summary.js           # Dashboard aggregates
```

---

## Database Schema

| Table | Purpose |
|-------|---------|
| `users` | App users (UUID PK, bcrypt passwords, roles: admin/user) |
| `institutes` | Training institutes — reg no, PAN, status, lat/lng, logo |
| `clients` | Donor/client master (Govt, NGO, INGO, etc.) |
| `occupations` | CTEVT standard occupations (309) + custom additions |
| `assignments` | Training assignments per institute per fiscal year |
| `assignment_occupations` | Occupations within an assignment (trainees, skill test results) |
| `assignment_locations` | Geographic locations per assignment (province/district/local level) |
| `nstb_records` | NSTB skill test records (applied/appeared/pass per occupation) |
| `tax_clearances` | Annual tax clearance certificates per institute |
| `affiliations` | CTEVT affiliation/renewal records |
| `affiliation_programs` | Programs within each affiliation |
| `assignment_templates` | Saved assignment templates (JSONB) |

---

## API Endpoints

All routes require `Authorization: Bearer <token>` except login and register.

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/auth/login` | Login, returns JWT |
| POST | `/api/auth/register` | Register new user |
| GET | `/api/auth/me` | Current user profile |
| GET/POST | `/api/institutes` | List / create institutes |
| GET/PUT/DELETE | `/api/institutes/:id` | Get / update / delete institute |
| GET/POST | `/api/assignments` | List / create assignments |
| GET/PUT/DELETE | `/api/assignments/:id` | Get / update / delete assignment |
| GET/POST | `/api/nstb` | List / create NSTB records |
| GET/POST | `/api/tax` | List / create tax clearances |
| GET/POST | `/api/affiliations` | List / create affiliations |
| GET/POST | `/api/clients` | List / create clients |
| GET/POST | `/api/occupations` | List / create occupations |
| GET | `/api/summary` | Dashboard aggregate stats |
| GET/POST | `/api/templates` | List / save assignment templates |

---

## Frontend Features

- **Dashboard** — institute stats, assignment counts, Nepal administrative map (CartoDB Light + Leaflet.js)
- **Institutes** — full CRUD, logo upload, Google Maps link, lat/lng for precise map pins
- **Assignments** — full-page bulk add form (multiple occupations + district locations per assignment)
- **NSTB Records** — full-page bulk add (one occupation per row, live pass % calculation)
- **Tax Clearance** — per-institute annual records
- **CTEVT Affiliation** — affiliation history with program list per affiliation
- **Clients** — donor/client master management
- **Occupations** — 309 CTEVT standard occupations + custom additions by admin
- **Nepal Map** — precise pins from lat/lng, district-approximate fallback, Google Maps link on click
- **Search** — live sidebar search with quick-jump to any institute
- **Pagination** — throughout all list views

---

## Local Development

### Backend

```bash
cd backend
cp .env.example .env      # set DATABASE_URL and JWT_SECRET
npm install
npm run db:setup          # creates schema and seeds initial data
npm run dev               # starts nodemon on port 4000
```

Required `.env` values:
```
DATABASE_URL=postgres://user:pass@host:5432/tvettrack
JWT_SECRET=your-secret-here
PORT=4000
```

### Frontend

Open `TVETtrack.html` directly in a browser. Update `API_BASE` near the top of the file:

```js
const API_BASE = 'http://localhost:4000/api';  // local
// const API_BASE = '/api';                    // production (Vercel proxy)
```

---

## Deployment

### Backend → Railway

```bash
cd backend
railway login
railway link          # link to existing Railway project
railway up            # deploy
```

Environment variables to set on Railway:
- `DATABASE_URL` — PostgreSQL connection string (auto-set if using Railway Postgres)
- `JWT_SECRET` — secret for signing JWTs
- `NODE_ENV=production`

### Frontend → Vercel

```bash
# From project root
vercel --prod
```

`vercel.json` proxies `/api/*` to Railway automatically. No extra config needed.

### Database Migrations

New columns are applied automatically on backend startup via `runMigrations()` in `server.js`. To add a migration, append an `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` statement to the migrations array in `server.js`.

---

## Environment Variables

| Variable | Where | Description |
|----------|-------|-------------|
| `DATABASE_URL` | Railway | PostgreSQL connection string |
| `JWT_SECRET` | Railway | JWT signing secret (keep secret) |
| `NODE_ENV` | Railway | Set to `production` |
| `PORT` | Railway | Auto-set by Railway (defaults to 4000) |
