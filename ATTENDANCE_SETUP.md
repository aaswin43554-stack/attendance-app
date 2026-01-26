# Attendance Setup Guide - Supabase

## Overview

This guide explains how the attendance tracking functionality works with Supabase.

## Database Setup

The attendance table is already set up. If you haven't created it yet, follow the **SUPABASE_SETUP.md** guide first.

### Attendance Table Structure

The `attendance` table has the following columns:

```sql
CREATE TABLE attendance (
  id VARCHAR(255) PRIMARY KEY,
  userId VARCHAR(255) NOT NULL,
  userName VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL CHECK (type IN ('checkin', 'checkout')),
  time TIMESTAMP NOT NULL,
  lat DECIMAL(10, 8),
  lng DECIMAL(11, 8),
  address TEXT,
  device TEXT,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## How Attendance Works

### Check-in Flow

1. **Employee clicks "Check In"** on the dashboard
2. **Frontend requests geolocation** from browser
3. **Location is reverse-geocoded** to get human-readable address
4. **Record is saved to both:**
   - Local storage (for offline support)
   - Supabase database (persistent storage)
5. **Confirmation displayed** to employee

### Check-out Flow

Same as check-in, but with `type: "checkout"`

## Data Recorded

Each attendance record includes:

| Field | Type | Description |
|-------|------|-------------|
| id | string | Unique record identifier |
| userId | string | User's email or ID |
| userName | string | User's full name |
| type | string | "checkin" or "checkout" |
| time | datetime | ISO timestamp of the event |
| lat | decimal | Latitude of location |
| lng | decimal | Longitude of location |
| address | string | Human-readable address |
| device | string | Device info (JSON) |
| createdAt | datetime | Record creation timestamp |

## Testing the Attendance System

### Manual Testing

1. **Start the development server:**
   ```bash
   npm run dev
   ```

2. **Go to Employee Login:**
   - URL: `http://localhost:5175/employee/login`
   - Use one of the test accounts from SUPABASE_SETUP.md

3. **After login, on the dashboard:**
   - Click **"Check In"**
   - Grant location permission when prompted
   - Wait for confirmation message

4. **Verify in Supabase:**
   - Go to Supabase dashboard
   - Navigate to **Table Editor** → **attendance**
   - You should see a new record with your name and timestamp

5. **Test Check Out:**
   - Click **"Check Out"** on the dashboard
   - Another record should appear in Supabase with `type: "checkout"`

### Viewing Attendance Records

**Via Supabase Dashboard:**

1. Go to Supabase → **Table Editor**
2. Select **attendance** table
3. Filter by employee name or date using the filters
4. Export data using the menu (CSV, JSON, etc.)

**Via Code:**

In any component, you can fetch attendance records:

```javascript
import { getUserAttendanceRecords, getAllAttendanceRecords } from './services/supabase';

// Get records for a specific user
const userRecords = await getUserAttendanceRecords('John Doe');

// Get all records
const allRecords = await getAllAttendanceRecords();

// Get records for a specific date
import { getAttendanceByDate } from './services/supabase';
const todayRecords = await getAttendanceByDate(new Date());
```

## Admin Dashboard Integration

The admin can view attendance records by:

1. **Login as Admin:**
   - Email: `admin@tronxlabs.com`
   - Password: `admin123`

2. **Navigate to Dashboard:**
   - View all employees' attendance
   - Filter by date, employee, or check-in/out type

3. **Export Data:**
   - Use the export feature to download as CSV/JSON
   - Use for reports or payroll processing

## Attendance Analytics

To get attendance summary for a specific date:

```javascript
const { getAttendanceByDate } = require('./services/supabase');

async function getDailySummary(date) {
  const records = await getAttendanceByDate(date);
  
  const summary = {};
  
  records.forEach(record => {
    if (!summary[record.userName]) {
      summary[record.userName] = { checkin: null, checkout: null };
    }
    
    if (record.type === 'checkin') {
      summary[record.userName].checkin = record.time;
    } else if (record.type === 'checkout') {
      summary[record.userName].checkout = record.time;
    }
  });
  
  return summary;
}
```

## Offline Support

The system includes offline support:

1. **Check-in/out requests** are saved to **local storage** first
2. **Then synced to Supabase** when online
3. **If Supabase sync fails**, it doesn't block the user
4. **Data persists locally** until manual sync

## Common Issues

### "Failed to record attendance"

Check:
1. Internet connection is active
2. Supabase credentials are correct in `.env.local`
3. `attendance` table exists in Supabase
4. Browser location permissions are granted

### "Location permission denied"

The browser is blocking geolocation:
1. Check if the site has location permission in browser settings
2. Use a localhost URL (not file://)
3. Grant permission when the prompt appears

### "No records showing in Supabase"

1. Check your `.env.local` has correct Supabase URL and key
2. Verify the attendance table exists (run the SQL setup from SUPABASE_SETUP.md)
3. Check browser console for errors
4. Verify you're logged in as the right user

### "Wrong location is being recorded"

This could be due to:
1. **GPS inaccuracy** - GPS can be 5-50m off
2. **Network location** - If GPS is disabled, browser uses network triangulation
3. **Reverse geocoding delay** - Address lookup might show cached address

## Production Considerations

Before deploying to production:

1. **Enable HTTPS** - Required for browser geolocation API
2. **Hash passwords** - Don't store plain text passwords
3. **Enable Row Level Security** - Restrict data access
4. **Add audit logs** - Track who accessed what data
5. **Set up backups** - Enable Supabase automated backups
6. **Monitor errors** - Set up error tracking (Sentry, LogRocket, etc.)
7. **Rate limiting** - Prevent abuse of check-in/out endpoint
8. **Data retention policy** - Define how long to keep records

## Database Queries

**Get today's check-ins:**
```sql
SELECT * FROM attendance 
WHERE type = 'checkin' 
AND DATE(time) = CURRENT_DATE
ORDER BY time DESC;
```

**Get check-in/out pairs:**
```sql
SELECT 
  DATE(time) as date,
  userName,
  MIN(CASE WHEN type = 'checkin' THEN time END) as check_in,
  MAX(CASE WHEN type = 'checkout' THEN time END) as check_out,
  EXTRACT(EPOCH FROM (MAX(CASE WHEN type = 'checkout' THEN time END) - 
           MIN(CASE WHEN type = 'checkin' THEN time END)))/3600 as hours_worked
FROM attendance
GROUP BY DATE(time), userName
ORDER BY date DESC, userName;
```

**Get attendance summary by user:**
```sql
SELECT 
  userName,
  COUNT(*) as total_records,
  COUNT(CASE WHEN type = 'checkin' THEN 1 END) as check_ins,
  COUNT(CASE WHEN type = 'checkout' THEN 1 END) as check_outs,
  MIN(time) as first_checkin,
  MAX(time) as last_checkout
FROM attendance
GROUP BY userName
ORDER BY userName;
```
