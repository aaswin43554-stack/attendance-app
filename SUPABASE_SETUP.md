# Supabase Setup Guide

## Overview

This project uses **Supabase** for user authentication and attendance tracking. Supabase is an open-source Firebase alternative that provides:
- PostgreSQL database
- Real-time functionality
- Built-in authentication
- RESTful API access

## Architecture

The system uses:
1. **Supabase PostgreSQL Database** - Store user accounts and attendance records
2. **Supabase Client Library** - Connect from frontend/backend
3. **Supabase Auth** - Manage user sessions (optional, currently using manual auth)

## Setup Steps

### Step 1: Create a Supabase Project

1. Go to [Supabase](https://supabase.com)
2. Sign up or log in with your account
3. Click **+ New Project**
4. Fill in the project details:
   - **Name:** tronxlabs-attendance
   - **Database Password:** Create a strong password (save this!)
   - **Region:** Choose the closest region to your users
   - **Pricing Plan:** Free tier is fine for development

5. Wait for the project to be created (takes ~1-2 minutes)

### Step 2: Create Database Tables

Once your project is created, go to the **SQL Editor** and run these queries:

#### Users Table

```sql
CREATE TABLE IF NOT EXISTS users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'employee')),
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
```

#### Attendance Table

```sql
CREATE TABLE IF NOT EXISTS attendance (
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

CREATE INDEX idx_attendance_userName ON attendance(userName);
CREATE INDEX idx_attendance_time ON attendance(time);
```

### Step 3: Get Your Credentials

1. In Supabase dashboard, go to **Settings** → **API**
2. You'll see:
   - **Project URL** - Copy this (your VITE_SUPABASE_URL)
   - **Anon Public Key** - Copy this (your VITE_SUPABASE_ANON_KEY)

### Step 4: Create `.env.local` File

In your project root directory, create a `.env.local` file:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
VITE_BACKEND_URL=http://localhost:3000
```

### Step 5: Install Dependencies

```bash
npm install
```

This will install the `@supabase/supabase-js` client library.

### Step 6: Initial Data (Optional)

Add some initial users to test the system. Go to **SQL Editor** in Supabase and run:

```sql
INSERT INTO users (email, password, name, phone, role) VALUES
('admin@tronxlabs.com', 'admin123', 'Admin User', '9876543210', 'admin'),
('emp1@tronxlabs.com', 'emp123', 'John Doe', '9999999999', 'employee'),
('emp2@tronxlabs.com', 'emp123', 'Jane Smith', '8888888888', 'employee');
```

## Testing

### Test User Signup

1. Start the development server:
   ```bash
   npm run dev
   ```

2. Go to Employee Signup page
3. Create an account with:
   - Name: Test Employee
   - Email: test@example.com
   - Password: test123
   - Phone: 9999999999

4. Check Supabase **Table Editor** → **users** table - should see the new user

### Test Attendance

1. Log in with the employee account
2. Click "Check In"
3. Allow location access
4. Check Supabase **Table Editor** → **attendance** table - should see the attendance record

## Database Schema Details

### Users Table

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Unique user identifier |
| email | VARCHAR | User email (unique) |
| password | VARCHAR | User password (plain text - consider hashing in production) |
| name | VARCHAR | User's full name |
| phone | VARCHAR | User's phone number |
| role | VARCHAR | Either 'admin' or 'employee' |
| createdAt | TIMESTAMP | Account creation timestamp |

### Attendance Table

| Column | Type | Description |
|--------|------|-------------|
| id | VARCHAR | Unique attendance record ID |
| userId | VARCHAR | Reference to user |
| userName | VARCHAR | User's name at time of check-in/out |
| type | VARCHAR | Either 'checkin' or 'checkout' |
| time | TIMESTAMP | Check-in/out timestamp |
| lat | DECIMAL | Latitude of location |
| lng | DECIMAL | Longitude of location |
| address | TEXT | Human-readable address |
| device | TEXT | Device information (JSON string) |
| createdAt | TIMESTAMP | Record creation timestamp |

## Security Considerations

### Current Setup (Development)

The current setup stores passwords as plain text. For **production**, you should:

1. **Hash passwords** using bcrypt or argon2:
   ```bash
   npm install bcryptjs
   ```

2. **Use Supabase Auth** instead of manual authentication:
   - Built-in password hashing
   - Session management
   - OAuth integration

3. **Enable Row Level Security (RLS)**:
   ```sql
   ALTER TABLE users ENABLE ROW LEVEL SECURITY;
   ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
   
   CREATE POLICY "Users can only see their own data" ON users
   FOR SELECT USING (auth.uid() = id);
   ```

4. **Use HTTPS** in production
5. **Rotate your API keys** regularly

## Common Issues

### "Cannot find module @supabase/supabase-js"

Run: `npm install @supabase/supabase-js`

### "Missing Supabase credentials"

Make sure your `.env.local` file has:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Restart your dev server after adding these.

### "Connection refused" or "Failed to connect"

1. Check that your Supabase project is active
2. Verify the URL is correct (no trailing slash)
3. Check your internet connection
4. Verify the Anon Key is correct

### Attendance not saving

1. Check browser console for errors
2. Verify your Supabase attendance table exists
3. Check that location permissions are granted
4. Look at Supabase logs for database errors

## Monitoring & Analytics

In Supabase dashboard, you can:

1. **View real-time data** in Table Editor
2. **Monitor database performance** in Logs
3. **Check API usage** in Analytics
4. **Set up alerts** for unusual activity

## Data Export

To export attendance data:

1. Go to **Table Editor** → **attendance**
2. Click the three dots menu
3. Select **Export** → Choose format (CSV, JSON, etc.)

## Switching Between Environments

To use different Supabase projects for development/production:

**Development (.env.local)**
```env
VITE_SUPABASE_URL=https://dev-project.supabase.co
VITE_SUPABASE_ANON_KEY=dev_key_here
```

**Production (.env.production)**
```env
VITE_SUPABASE_URL=https://prod-project.supabase.co
VITE_SUPABASE_ANON_KEY=prod_key_here
```

## Next Steps

1. Set up Row Level Security for better security
2. Implement password hashing with bcrypt
3. Add Supabase Auth for better session management
4. Set up automated backups
5. Create admin dashboard for data management

## Support

For issues with Supabase:
- [Supabase Documentation](https://supabase.com/docs)
- [Supabase Community](https://discord.supabase.io)
- [GitHub Issues](https://github.com/supabase/supabase/issues)
