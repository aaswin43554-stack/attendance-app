# TronX Labs Attendance App — CLAUDE.md

## What This Project Is

A role-based employee attendance tracking web app for **TronX Labs**, a company operating in Thailand and Laos. Employees check in/out via GPS. Admins monitor the whole team. Team leaders manage their assigned employees. The app is deployed on Render.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite 7, React Router v6 |
| Backend | Express.js 5 (Node.js, ESM) |
| Database | Supabase (PostgreSQL + Realtime) |
| Maps | Leaflet + React-Leaflet |
| Email (primary) | Resend API |
| Email (fallback) | Nodemailer / Gmail SMTP |
| Hosting | Render (`attendance-app-i868.onrender.com`) |
| Build tool | Vite (output: `dist/`) |

---

## Running the Project

```bash
# Development (runs Vite frontend + Express backend concurrently)
npm run dev

# Frontend only
npm run dev:vite        # http://localhost:5173

# Backend only
npm run dev:backend     # http://localhost:10000

# Production build
npm run build

# Production server (serves built dist/ + API)
npm start
```

Environment variables must be in `.env.local` for local dev. See `.env.example` for all required keys.

---

## Environment Variables

### Backend (`server.js`)
| Variable | Purpose |
|---|---|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (admin access) |
| `RESEND_API_KEY` | Resend API key for OTP emails |
| `RESEND_FROM_EMAIL` | From address for Resend emails |
| `EMAIL_USER` | Gmail address for Nodemailer fallback |
| `EMAIL_PASS` | Gmail app password for Nodemailer |
| `PORT` | Server port (default: 10000) |

### Frontend (Vite build, prefix `VITE_`)
| Variable | Purpose |
|---|---|
| `VITE_SUPABASE_URL` | Supabase URL (exposed to browser) |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key (exposed to browser) |
| `VITE_API_BASE_URL` | Backend URL (e.g. `https://attendance-app-i868.onrender.com`) |
| `VITE_BACKEND_URL` | Proxy backend URL for PATCH workaround |

---

## Project Structure

```
attendance-app/
├── server.js                   # Express backend: OTP reset, email, proxy routes
├── src/
│   ├── App.jsx                 # Routes + role-based guards
│   ├── main.jsx                # React entry
│   ├── context/
│   │   └── LanguageContext.jsx # Language provider (en/th/la)
│   ├── pages/
│   │   ├── Login.jsx
│   │   ├── ForgotPassword.jsx
│   │   ├── ResetPassword.jsx
│   │   ├── ResetPasswordOTP.jsx
│   │   ├── admin/AdminDashboard.jsx
│   │   ├── employee/EmployeeDashboard.jsx
│   │   ├── employee/EmployeeSignup.jsx
│   │   └── team-leader/TeamLeaderDashboard.jsx
│   ├── services/
│   │   ├── supabase.js         # All Supabase DB calls
│   │   ├── auth.js             # Login/signup/password reset logic
│   │   ├── attendance.js       # Check-in/out, batch, team-leader bulk
│   │   ├── geo.js              # Geolocation + reverse geocode
│   │   └── storage.js          # localStorage: session + offline attendance
│   ├── ui/
│   │   ├── AttendanceCalendar.jsx/.css
│   │   ├── LocationMap.jsx     # Leaflet map wrapper
│   │   ├── TopNav.jsx
│   │   ├── Card.jsx
│   │   └── Toast.jsx
│   └── utils/
│       ├── date.js             # Bangkok time formatting, network time
│       └── translations.js     # i18n strings (en, th, la)
├── dist/                       # Vite build output (served by Express in prod)
├── vite.config.js
└── package.json
```

---

## User Roles & Routes

| Role | Route | Access Guard |
|---|---|---|
| `employee` | `/employee/dashboard` | `RequireEmployee` |
| `team_leader` | `/team-leader/dashboard` | `RequireTeamLeader` |
| `admin` | `/admin/dashboard` | `RequireAdmin` |

All guards live in `src/App.jsx` and read from `localStorage` via `getSession()`. New employees sign up at `/employee/signup` and default to the `employee` role. Admins promote users from the Admin Dashboard.

---

## Database Schema (Supabase)

### `users` table
| Column | Type | Notes |
|---|---|---|
| `id` | uuid | Supabase Auth UID |
| `email` | text | lowercase, unique |
| `password` | text | **Stored in plaintext** — known issue |
| `name` | text | Display name |
| `phone` | text | Optional |
| `role` | text | `employee`, `team_leader`, `admin` |
| `managed_by` | text | Email of the team leader (if any) |
| `createdAt` | timestamptz | |

### `attendance` table
| Column | Type | Notes |
|---|---|---|
| `id` | text | Custom `a_`-prefixed hex ID |
| `userName` | text | Employee name or `Worker N (via Leader)` |
| `type` | text | `checkin` or `checkout` |
| `time` | timestamptz | UTC ISO from WorldTimeAPI |
| `lat` | float | GPS latitude |
| `lng` | float | GPS longitude |
| `address` | text | Reverse-geocoded from Nominatim |
| `device` | text/json | User agent, platform, language |
| `checked_in_by` | text | Team leader name (bulk records) |
| `shared_device` | bool | True for team-leader bulk records |

### `password_resets` table
| Column | Type | Notes |
|---|---|---|
| `email` | text | Primary key / conflict key |
| `otp_hash` | text | bcrypt hash of 6-digit OTP |
| `expires_at` | timestamptz | 10 minutes from creation |
| `attempts` | int | Max 5 before lockout |
| `created_at` | timestamptz | |

---

## Key Architecture Decisions

### Auth approach
Authentication uses a **custom `users` table**, not Supabase Auth sessions. Passwords are compared directly in the DB query (`eq("password", pass)`). Supabase Auth is used **only** for password reset via OTP (the admin API updates the auth password). Session is stored in `localStorage` under key `tronxlabs_session_v5`.

### CORS / PATCH proxy workaround
Supabase PATCH requests are blocked by adblockers in some environments. `src/services/supabase.js` catches `"Failed to fetch"` errors and retries via the Express backend proxy at `/api/update-user-role` and `/api/assign-manager`.

### Timestamps — always use network time
All attendance timestamps use `getNetworkTime()` (`src/utils/date.js`), which fetches from `https://worldtimeapi.org/api/timezone/Asia/Bangkok` with a 3.5s timeout, falling back to `new Date()`. Never use `new Date()` directly for attendance records.

### Bangkok timezone
All displayed times are formatted in `Asia/Bangkok` (UTC+7). Use `formatBangkokTime()`, `getBangkokYMD()`, and `getBangkokTimeParts()` from `src/utils/date.js`. DB records are stored as UTC ISO strings.

### Worker IDs (virtual workers)
Employees can batch check-in "Worker 1" through "Worker N" (physical workers without devices). These are stored in `attendance` with `userName` = `"Worker N (via EmployeeName)"`. In the Admin Dashboard they appear as virtual employees derived from attendance records.

### Team leader bulk attendance
Team leaders can check in/out all their assigned employees in one action via `createTeamLeaderBulkAttendance()`. The `device` JSON stores `checkedInBy` and `sharedDevice: true` to flag these records.

### Offline fallback
Attendance is written to `localStorage` (`tronxlabs_attendance_v5`) first, then synced to Supabase. If Supabase fails, the local record is still saved.

---

## Multi-language Support

Three languages supported via `src/utils/translations.js`:
- `en` — English
- `th` — Thai
- `la` — Lao

Language selection is persisted in `localStorage` under `app_lang`. Access translations via the `useLanguage()` hook which exposes `t(key)`.

When adding UI text, **always add the key to all three language objects** in `translations.js`.

---

## Password Reset Flow

Two flows exist:

**1. OTP flow (primary, used in production):**
- User submits email → `POST /api/auth/request-reset`
- Server generates 6-digit OTP, bcrypt-hashes it, stores in `password_resets` table, sends via Resend
- User enters OTP → `POST /api/auth/verify-reset`
- Server verifies hash, updates Supabase Auth password, deletes reset record
- Rate limit: 5 requests/hour per email; lockout after 5 failed OTP attempts

**2. Native Supabase reset (fallback):**
- `supabase.auth.resetPasswordForEmail()` sends a magic link to `/reset-password`
- Falls back to `/api/auth/send-recovery-link` if Supabase returns an error

---

## API Endpoints (Express backend)

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | Health check |
| GET | `/api/debug/table-check` | Verify `password_resets` table exists |
| POST | `/api/auth/request-reset` | Generate + email OTP |
| POST | `/api/auth/verify-reset` | Verify OTP + update password |
| POST | `/api/send-otp` | Legacy Nodemailer OTP (dev) |
| POST | `/api/verify-otp` | Legacy in-memory OTP verify |
| POST | `/api/update-user-role` | Proxy: update user role in Supabase |
| POST | `/api/assign-manager` | Proxy: assign employee to team leader |

---

## Known Issues / Technical Debt

1. **Unresolved merge conflict in `server.js`** — there is a `<<<<<<< HEAD` conflict marker at line 346. Resolve before deploying.
2. **Plaintext passwords** — `users.password` is stored and compared in plaintext. Needs bcrypt hashing in the `users` table (the `password_resets` table already uses bcrypt correctly).
3. **Duplicate route in `App.jsx`** — `/login` is declared twice (lines 55–56). Remove the duplicate.
4. **In-memory OTP store** — the legacy `otpStore` Map in `server.js` is lost on server restart. Already superseded by the DB-backed OTP flow but not removed.
5. **Anon key hardcoded** — `.env.example` contains actual Supabase anon key and Resend API key in plaintext. These should be rotated and kept only in `.env.local`.

---

## Supabase Realtime

The Employee Dashboard subscribes to the `attendance` table via Supabase Realtime:
```js
supabase.channel(`employee_realtime_${me.name}`)
  .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance' }, handler)
  .subscribe()
```
The channel is cleaned up on component unmount.

---

## GPS & Geocoding

- GPS: `navigator.geolocation.getCurrentPosition()` with `enableHighAccuracy: true`, 15s timeout, no cache.
- Reverse geocode: OpenStreetMap Nominatim (`https://nominatim.openstreetmap.org/reverse`). Returns `display_name`. Fails silently (returns `""`).
- Accuracy warning logged if GPS accuracy > 1000m (likely IP-based).

---

## Admin Dashboard Features

- View all employees + virtual workers
- See live working status (derived from latest attendance record)
- Click employee to expand: latest location on Leaflet map, recent logs
- Per-employee or global work hour settings (stored in `localStorage` as `work_settings_v2`)
- Late login / early logout warnings based on work hour thresholds
- Assign roles (`employee` → `team_leader` or `admin`)
- Assign employees to team leaders (`managed_by` field)
- Export attendance to CSV
- Attendance calendar view
