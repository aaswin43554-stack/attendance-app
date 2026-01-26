# Quick Start: Supabase Setup

## 🚀 5-Minute Setup

### Step 1: Create Supabase Project
1. Go to https://supabase.com
2. Sign up/login
3. Click **+ New Project**
4. Fill in: Name, Database Password, Region
5. Wait 1-2 minutes for creation

### Step 2: Create Database Tables
In Supabase **SQL Editor**, run:

```sql
-- Users table
CREATE TABLE users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'employee')),
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);

-- Attendance table
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

CREATE INDEX idx_attendance_userName ON attendance(userName);
CREATE INDEX idx_attendance_time ON attendance(time);

-- Add test users
INSERT INTO users (email, password, name, phone, role) VALUES
('admin@tronxlabs.com', 'admin123', 'Admin User', '9876543210', 'admin'),
('emp1@tronxlabs.com', 'emp123', 'John Doe', '9999999999', 'employee'),
('emp2@tronxlabs.com', 'emp123', 'Jane Smith', '8888888888', 'employee');
```

### Step 3: Get Credentials
In Supabase **Settings** → **API**:
- Copy **Project URL** → `VITE_SUPABASE_URL`
- Copy **Anon Public Key** → `VITE_SUPABASE_ANON_KEY`

### Step 4: Create `.env.local`
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
VITE_BACKEND_URL=http://localhost:3000
```

### Step 5: Run App
```bash
npm install
npm run dev
```

## 🧪 Test It

1. **Employee Login:** http://localhost:5175/employee/login
   - Email: `emp1@tronxlabs.com`
   - Password: `emp123`

2. **Admin Login:** http://localhost:5175/admin/login
   - Email: `admin@tronxlabs.com`
   - Password: `admin123`

3. **Try Check-in/out:**
   - Click "Check In" on employee dashboard
   - Should appear in Supabase **attendance** table

## 📚 Full Documentation

- **Setup Details:** [SUPABASE_SETUP.md](SUPABASE_SETUP.md)
- **Attendance System:** [ATTENDANCE_SETUP.md](ATTENDANCE_SETUP.md)
- **Migration Info:** [MIGRATION_GUIDE.md](MIGRATION_GUIDE.md)
- **Main README:** [README.md](README.md)

## ⚠️ Common Issues

| Issue | Solution |
|-------|----------|
| Module not found | `npm install && npm run dev` |
| Missing credentials | Check `.env.local` exists and restart dev |
| Failed to fetch users | Verify Supabase tables exist |
| Location denied | Use localhost (not file://) and grant permission |

## 🔐 For Production

1. Hash passwords with bcrypt
2. Enable Row Level Security (RLS)
3. Use Supabase Auth for sessions
4. Set up backups
5. Enable HTTPS

See [SUPABASE_SETUP.md](SUPABASE_SETUP.md) → Security Considerations for details.

---

**That's it! Start developing! 🎉**
