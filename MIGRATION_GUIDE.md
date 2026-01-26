# Migration Guide: Google Sheets → Supabase

## Overview

This document explains how the project has been migrated from Google Sheets to Supabase for authentication and attendance tracking.

## What Changed

### 1. **Service Layer**
   - **Old:** `src/services/googleSheets.js` ✓ (Removed)
   - **New:** `src/services/supabase.js` (Uses Supabase client)

### 2. **Authentication**
   - **Old:** Google Sheets + Apps Script API
   - **New:** Supabase PostgreSQL database

### 3. **Database**
   - **Old:** Google Sheets tabs (users, attendance)
   - **New:** PostgreSQL tables (users, attendance)

### 4. **Backend Requirement**
   - **Old:** Backend proxy required (for CORS)
   - **New:** Supabase client handles it directly (no extra proxy needed)

### 5. **Dependencies**
   - **Added:** `@supabase/supabase-js` (^2.38.4)

## File Changes

### Modified Files

1. **[src/services/auth.js](src/services/auth.js)**
   - Changed import from `googleSheets` to `supabase`
   - Updated comments to reference Supabase

2. **[src/services/attendance.js](src/services/attendance.js)**
   - Changed import from `googleSheets` to `supabase`
   - Updated error messages to reference Supabase

3. **[package.json](package.json)**
   - Added `@supabase/supabase-js` to dependencies

### Removed Files

- `GOOGLE_SHEETS_SETUP.md` - No longer needed
- `src/services/googleSheets.js` - Replaced by supabase.js

### New Files

- **[src/services/supabase.js](src/services/supabase.js)** - Main database service
- **[SUPABASE_SETUP.md](SUPABASE_SETUP.md)** - Setup instructions
- **[MIGRATION_GUIDE.md](MIGRATION_GUIDE.md)** - This file

### Updated Files

- **[ATTENDANCE_SETUP.md](ATTENDANCE_SETUP.md)** - Now references Supabase
- **[BACKEND_PROXY_SETUP.md](BACKEND_PROXY_SETUP.md)** - May still reference old system

## API Changes

### User Management

**Before (Google Sheets):**
```javascript
import { addUser, getUserByEmailAndPassword } from './services/googleSheets';
```

**After (Supabase):**
```javascript
import { addUser, getUserByEmailAndPassword } from './services/supabase';
```

The function signatures remain the same, so no changes needed in `auth.js` or other services.

### Attendance Management

**Before:**
```javascript
await recordAttendance(record);  // Sent to Google Sheets
```

**After:**
```javascript
await recordAttendance(record);  // Sent to Supabase
```

Same function signature - just different backend.

## Environment Variables

### Before
```env
VITE_GOOGLE_SHEETS_API_URL=https://script.google.com/macros/s/{ID}/usercontent
VITE_GOOGLE_SHEETS_ID={SHEET_ID}
VITE_BACKEND_URL=http://localhost:3000
```

### After
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
VITE_BACKEND_URL=http://localhost:3000  # Still used, but optional now
```

## Setup Steps

### For Development

1. **Follow SUPABASE_SETUP.md** to:
   - Create a Supabase project
   - Create database tables
   - Get your credentials

2. **Update .env.local:**
   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your_anon_key_here
   ```

3. **Install dependencies:**
   ```bash
   npm install
   ```

4. **Start the app:**
   ```bash
   npm run dev
   ```

### For Production

See **SUPABASE_SETUP.md** → **Security Considerations** section for:
- Password hashing recommendations
- Row Level Security setup
- Audit logging
- Backup strategies

## Testing

### Quick Test

1. Sign up a new employee account
2. Check Supabase dashboard → Table Editor → users
3. Should see your new user
4. Try check-in/out
5. Check Supabase dashboard → Table Editor → attendance
6. Should see your attendance records

## Rollback Instructions

If you need to revert to Google Sheets:

1. **Restore old files:**
   - Get `src/services/googleSheets.js` from git history
   - Restore old `GOOGLE_SHEETS_SETUP.md`

2. **Update imports:**
   ```javascript
   // Change supabase back to googleSheets
   import { ... } from './services/googleSheets';
   ```

3. **Restore package.json dependencies:**
   - Remove `@supabase/supabase-js`

4. **Restore environment variables:**
   ```env
   VITE_GOOGLE_SHEETS_API_URL=...
   VITE_GOOGLE_SHEETS_ID=...
   VITE_BACKEND_URL=...
   ```

## Known Differences

| Feature | Google Sheets | Supabase |
|---------|---------------|----------|
| **Scalability** | Limited (file size) | Unlimited |
| **Query Speed** | Slower (full fetch) | Fast (indexed queries) |
| **Real-time** | No | Yes (with subscriptions) |
| **Security** | Manual | Built-in RLS |
| **Backups** | Manual | Automatic |
| **Cost** | Free | Free tier, paid plans |
| **Learning Curve** | Low | Medium |

## Common Issues During Migration

### Issue: "Module not found: @supabase/supabase-js"

**Solution:**
```bash
npm install
npm run dev
```

### Issue: "Missing Supabase credentials"

**Solution:**
1. Check `.env.local` exists
2. Verify `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set
3. Restart dev server

### Issue: "Failed to fetch users from database"

**Solution:**
1. Verify Supabase project is active
2. Check that `users` table exists
3. Look at browser console for details
4. Check Supabase dashboard for errors

### Issue: "Authentication failed" after migration

**Solution:**
1. Clear browser localStorage
2. Make sure you're using correct credentials
3. Verify users table exists and has data
4. Try creating a new test user

## Data Migration from Google Sheets (If Needed)

If you want to migrate existing data from Google Sheets to Supabase:

1. **Export from Google Sheets:**
   - Select the data range
   - Copy
   - Paste into CSV file

2. **Import into Supabase:**
   - Go to Table Editor
   - Click "Insert" → "Paste from CSV"
   - Or use the SQL Editor to run INSERT statements

3. **Verify:**
   - Check row counts match
   - Verify data integrity
   - Test login with migrated users

## Next Steps

1. **Read SUPABASE_SETUP.md** for detailed setup
2. **Read ATTENDANCE_SETUP.md** for how attendance works
3. **Enable Row Level Security** for production
4. **Set up monitoring and backups**
5. **Test all features** before deploying

## Support

For issues:
- Check the console for error messages
- See SUPABASE_SETUP.md troubleshooting section
- Review Supabase documentation: https://supabase.com/docs
- Check project GitHub issues
