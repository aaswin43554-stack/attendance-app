# Backend Proxy Setup Guide

## Overview
This backend proxy solves the CORS issue by forwarding requests to Google Sheets API from the server side instead of the browser.

**Why?** Google Apps Script doesn't allow direct browser requests from different domains, but it accepts server-to-server requests.

## Architecture

```
User's Browser (Render)
         ↓
  Frontend App (http://localhost:5173)
         ↓
  Backend Proxy (http://localhost:3000)
         ↓
  Google Apps Script API
         ↓
  Google Sheets
```

## Local Development

### Run Both Frontend & Backend Together

```bash
npm run dev:all
```

This runs:
- Frontend: http://localhost:5173
- Backend: http://localhost:3000

### Or Run Separately

**Terminal 1 - Frontend:**
```bash
npm run dev
```

**Terminal 2 - Backend:**
```bash
npm run dev:backend
```

## Deployment to Render

### Step 1: Update Render Settings

1. Go to your Render dashboard
2. Select your service
3. Go to **Environment** → Add these variables:

```
VITE_BACKEND_URL=https://your-render-app.onrender.com
VITE_GOOGLE_SHEETS_API_URL=https://script.google.com/macros/s/{YOUR_SCRIPT_ID}/usercontent
VITE_GOOGLE_SHEETS_ID={YOUR_SHEET_ID}
```

### Step 2: Update Build & Start Commands

Go to **Settings** in Render:

- **Build Command:**
  ```
  npm install
  npm run build
  ```

- **Start Command:**
  ```
  npm run start
  ```

This starts the backend server on the same instance.

### Step 3: Update .render/render.yaml (if using)

```yaml
services:
  - type: web
    name: attendance-app
    env: node
    buildCommand: npm install && npm run build
    startCommand: npm run start
    envVars:
      - key: PORT
        value: 3000
      - key: VITE_BACKEND_URL
        value: https://your-render-app.onrender.com
      - key: VITE_GOOGLE_SHEETS_API_URL
        value: https://script.google.com/macros/s/{YOUR_ID}/usercontent
```

## How It Works

### Flow:

1. **User signs up** → Frontend sends to `/api/sheets`
2. **Backend proxy** receives request → Forwards to Google Sheets API
3. **Google Sheets** processes and returns data
4. **Backend** returns response to frontend
5. **Frontend** displays result

### Example Request/Response:

**Frontend sends:**
```javascript
POST http://localhost:3000/api/sheets
{
  action: "addUser",
  user: { email: "john@example.com", password: "123", name: "John", ... }
}
```

**Backend forwards to Google Sheets:**
```javascript
POST https://script.google.com/macros/s/{ID}/usercontent
{
  action: "addUser",
  user: { email: "john@example.com", password: "123", name: "John", ... }
}
```

**Google Sheets processes** → Adds user to sheet → Returns success

**Backend responds to frontend:**
```javascript
{ success: true }
```

## Environment Variables

### Local (.env.local)
```
VITE_BACKEND_URL=http://localhost:3000
VITE_GOOGLE_SHEETS_API_URL=https://script.google.com/macros/s/{ID}/usercontent
VITE_GOOGLE_SHEETS_ID={SHEET_ID}
```

### Production (Render)
```
VITE_BACKEND_URL=https://your-app.onrender.com
VITE_GOOGLE_SHEETS_API_URL=https://script.google.com/macros/s/{ID}/usercontent
VITE_GOOGLE_SHEETS_ID={SHEET_ID}
```

## Ports

- **Frontend:** 5173 (Vite dev server)
- **Backend:** 3000 (Express server)
- **Render:** Both run on PORT 3000 in production

## Testing

### Local Test:
1. Run `npm run dev:all`
2. Go to http://localhost:5173/employee/signup
3. Create account → Should save to Google Sheets
4. Check console for "Backend unavailable" warnings

### Production Test:
1. Go to https://your-app.onrender.com/employee/signup
2. Create account
3. Check Google Sheet for new entry
4. Should appear within 5 seconds

## Troubleshooting

### "Backend unavailable, falling back to localStorage"
- Check if backend is running: `npm run dev:backend`
- Check if `VITE_BACKEND_URL` is set correctly
- Check if port 3000 is available locally
- On Render, check service logs for errors

### "Google Sheets API returned 403"
- Google Sheets API URL is incorrect
- Check `.env.local` has correct URL
- Verify Google Apps Script deployment exists
- Make sure Apps Script is published with "Anyone" access

### Data not syncing to Google Sheets
- Check if using production or localStorage mode
- Verify `VITE_BACKEND_URL` points to correct server
- Check browser console for network errors
- Verify Google Apps Script has `addUser` and `addAttendance` functions

## Files Added/Modified

- **New:** `server.js` - Backend Express server
- **Modified:** `src/services/googleSheets.js` - Uses backend proxy
- **Modified:** `package.json` - Added backend scripts
- **Modified:** `.env.local` - Added `VITE_BACKEND_URL`
- **Modified:** `.gitignore` - Protects `.env` files

## Next Steps

1. Test locally with `npm run dev:all`
2. Push to GitHub
3. Deploy to Render with environment variables
4. Test signup/check-in to verify Google Sheets sync
