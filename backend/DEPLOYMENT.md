# TVETtrack — Deployment Guide

## Architecture overview

| Layer | Current state | Future state |
|---|---|---|
| Frontend | Single HTML file, all data in `localStorage` | Same file, API-connected |
| Auth | localStorage-based, users managed in-app | JWT via backend `/api/auth` |
| Backend | Node.js + Express (built, not yet wired to frontend) | Railway / any Node host |
| Database | — | PostgreSQL on Railway |

---

## Quick start — frontend only (no backend needed)

The app works fully standalone with no server:

```bash
# Option 1 — just open in browser
open TVETtrack.html

# Option 2 — serve locally (avoids any browser file:// restrictions)
npx serve .
# Then open http://localhost:3000/TVETtrack.html
```

Default login credentials (stored in `localStorage` on first load):

| Username | Password | Role |
|---|---|---|
| `admin` | `admin123` | Admin |
| `viewer` | `viewer123` | Viewer |

**Change these immediately** via the **User management** screen (admin only) after first login.

---

## Auth & user management

Authentication is currently handled entirely in the frontend:

- Users are stored in `localStorage` under the key `tvettrack_users`
- Sessions are stored under `tvettrack_session`
- Role-based access: `admin` and `viewer`

**Admin capabilities:**
- Add / edit / deactivate users from the **User management** screen (sidebar)
- Access Master data (clients, occupations)
- Add and edit institutes

**Viewer capabilities:**
- Read-only access to all institute data, summary, and comparison views
- Cannot add institutes, manage users, or edit master data

To reset all users to defaults, clear the `tvettrack_users` key from browser localStorage.

---

## Hosting the frontend

Since the app is a single HTML file, any static host works:

### Netlify (recommended — free)
1. Go to [netlify.com](https://netlify.com) → Add new site → Deploy manually
2. Drag and drop the `TVETtrack_Complete/` folder
3. Netlify will serve `index.html` (the redirect) which forwards to `TVETtrack.html`

### GitHub Pages
```bash
cd TVETtrack_Complete
git init
git add TVETtrack.html index.html nepal_locations_final.json
git commit -m "Initial deploy"
# Push to GitHub, then enable Pages in repo Settings → Pages → Deploy from branch
```

### Railway (static)
1. Create a new Railway project → Add service → GitHub repo
2. Set start command: `npx serve -p $PORT .`
3. Railway provides a `*.up.railway.app` URL

### Serve locally for a team on the same network
```bash
npx serve -p 3456 .
# Share http://<your-local-ip>:3456/TVETtrack.html with others on the LAN
```

---

## Backend deployment (for future API integration)

The backend is built and ready but **not yet connected to the frontend**. Deploy it when you're ready to move data off localStorage to a shared database.

### Step 1 — Set up Railway account
```bash
npm install -g @railway/cli
railway login
```

### Step 2 — Create project and add PostgreSQL
```bash
cd backend
railway init          # choose "Empty project", name it "tvettrack"
```
In Railway dashboard → New → Database → PostgreSQL. Copy the `DATABASE_URL`.

### Step 3 — Set environment variables
In Railway dashboard → your service → Variables:
```
DATABASE_URL=<from PostgreSQL service — Railway sets this automatically if linked>
JWT_SECRET=<run: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))">
NODE_ENV=production
FRONTEND_URL=https://your-frontend-url.netlify.app
```

### Step 4 — Deploy
```bash
cd backend
railway up
# Railway detects Node.js, installs deps, starts with: node server.js
# URL: https://tvettrack-backend.up.railway.app
```

### Step 5 — Set up database schema
```bash
railway run node -e "
const {Pool}=require('pg');
const fs=require('fs');
const pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:false}});
pool.query(fs.readFileSync('db/schema.sql','utf8')).then(()=>pool.query(fs.readFileSync('db/seed.sql','utf8'))).then(()=>{console.log('Done');process.exit(0)}).catch(e=>{console.error(e);process.exit(1)});
"
```

Or paste `db/schema.sql` then `db/seed.sql` directly into Railway's PostgreSQL query editor.

### Step 6 — Migrate users from localStorage to backend

When switching to the backend, seed your existing users:

```bash
# Create the first admin via API
curl -X POST https://your-app.up.railway.app/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Administrator","email":"admin@yourorg.np","password":"<new-secure-password>","role":"admin"}'
```

Then add remaining users through the backend API or the User management screen once it's wired up.

### Step 7 — Connect frontend to backend

In `TVETtrack.html`, update the API base URL constant and switch data calls from localStorage to fetch:

```javascript
const API_BASE_URL = 'https://your-app.up.railway.app/api';
```

---

## API reference

### Authentication
```
POST /api/auth/register  — Create user (admin only in production)
POST /api/auth/login     — Login, returns JWT token
GET  /api/auth/me        — Get current user info
```

All routes below require: `Authorization: Bearer <token>`

### Institutes
```
GET    /api/institutes                      — List (supports ?status=Active&search=)
GET    /api/institutes/:id                  — Single institute with all sub-records
POST   /api/institutes                      — Create
PUT    /api/institutes/:id                  — Update
DELETE /api/institutes/:id                  — Delete (admin only)
```

### Assignments (Experience)
```
GET    /api/assignments?institute_id=X&fy=2081/82
POST   /api/assignments                     — Create with occupations + locations
PUT    /api/assignments/:id
DELETE /api/assignments/:id
```

### NSTB Records
```
GET    /api/nstb?institute_id=X&fy=2081/82
POST   /api/nstb                            — Accepts single record or array of records
PUT    /api/nstb/:id
DELETE /api/nstb/:id
```

### Tax Clearances
```
GET    /api/tax?institute_id=X
POST   /api/tax
PUT    /api/tax/:id
DELETE /api/tax/:id
```

### CTEVT Affiliations
```
GET    /api/affiliations?institute_id=X
POST   /api/affiliations                    — With programs array
PUT    /api/affiliations/:id
DELETE /api/affiliations/:id
```

### Master data
```
GET    /api/clients                         — All active clients
POST   /api/clients                         — Add (admin only)
PUT    /api/clients/:id                     — Update (admin only)
DELETE /api/clients/:id                     — Deactivate (admin only)

GET    /api/occupations                     — All (supports ?sector=&search=)
POST   /api/occupations                     — Add custom (admin only)
```

### Reports & templates
```
GET    /api/summary?institute_id=1&fys=2081/82,2080/81&client_types=Government
GET    /api/templates                       — User's saved assignment templates
POST   /api/templates
DELETE /api/templates/:id
```

---

## Security checklist

- [ ] Change the default `admin` / `viewer` passwords on first login
- [ ] Set a strong `JWT_SECRET` before deploying the backend (never commit it)
- [ ] Railway auto-provisions SSL — always use HTTPS frontend URLs
- [ ] Set `FRONTEND_URL` to your actual frontend domain (not `*`) in production
- [ ] Reference letter files are stored as base64 in the DB — for large-scale use, replace with Cloudinary:
  ```bash
  npm install cloudinary
  ```
  Then swap the base64 storage in `routes/assignments.js` with a Cloudinary upload URL.
- [ ] When migrating from localStorage to the backend, revoke/rotate any old localStorage sessions by clearing `tvettrack_session` in all browsers
