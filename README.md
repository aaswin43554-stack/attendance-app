# TronxLabs Attendance System

A modern, geolocation-based employee attendance tracking system built with React, Vite, and Supabase.

## Features

- **Employee Authentication:** Signup and login with email/password
- **Admin Dashboard:** View all employee attendance records
- **Geolocation Tracking:** Automatic GPS and reverse geocoding for check-in/out locations
- **Real-time Synchronization:** Supabase backend for data persistence
- **Offline Support:** Local storage fallback when offline
- **Responsive Design:** Works on desktop and mobile devices

## Tech Stack

### Frontend
- **React 19** - UI framework
- **Vite** - Build tool and dev server
- **React Router** - Client-side routing
- **Axios** - HTTP client
- **CSS3** - Styling

### Backend
- **Supabase** - PostgreSQL database, authentication, and API
- **Express.js** - Optional backend proxy (Node.js)

### Infrastructure
- Geolocation API - Browser's native geolocation
- Reverse Geocoding - Convert GPS to addresses

## Project Structure

```
src/
├── pages/
│   ├── admin/
│   │   ├── AdminDashboard.jsx
│   │   └── AdminLogin.jsx
│   └── employee/
│       ├── EmployeeDashboard.jsx
│       ├── EmployeeLogin.jsx
│       └── EmployeeSignup.jsx
├── services/
│   ├── supabase.js          # Supabase database service
│   ├── auth.js              # Authentication logic
│   ├── attendance.js        # Attendance tracking
│   ├── geo.js               # Geolocation and reverse geocoding
│   └── storage.js           # Local storage management
├── ui/
│   ├── Card.jsx
│   ├── Toast.jsx
│   └── TopNav.jsx
├── styles/
│   └── theme.css
├── App.jsx
└── main.jsx
```

## Quick Start

### Prerequisites

- Node.js 16+ and npm
- Supabase account (free at [supabase.com](https://supabase.com))

### Setup

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd tronxlabs-attendance
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up Supabase:**
   - Follow [SUPABASE_SETUP.md](SUPABASE_SETUP.md) for detailed instructions
   - Create database tables
   - Get your credentials

4. **Create `.env.local`:**
   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your_anon_key_here
   VITE_BACKEND_URL=http://localhost:3000
   ```

5. **Start development server:**
   ```bash
   npm run dev
   ```

6. **Open browser:**
   - App: http://localhost:5175
   - Employee Login: http://localhost:5175/employee/login
   - Admin Login: http://localhost:5175/admin/login

## Development

### Available Scripts

```bash
# Start dev server
npm run dev

# Start dev server with backend proxy
npm run dev:all

# Build for production
npm build

# Preview production build
npm run preview

# Run linter
npm run lint

# Start backend proxy only
npm run dev:backend
```

### Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_SUPABASE_URL` | Supabase project URL | `https://abc123.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Supabase anonymous key | `eyJhbG...` |
| `VITE_BACKEND_URL` | Backend proxy URL (optional) | `http://localhost:3000` |

## Documentation

- **[SUPABASE_SETUP.md](SUPABASE_SETUP.md)** - Database setup and configuration
- **[ATTENDANCE_SETUP.md](ATTENDANCE_SETUP.md)** - Attendance system details
- **[BACKEND_PROXY_SETUP.md](BACKEND_PROXY_SETUP.md)** - Optional backend proxy setup
- **[MIGRATION_GUIDE.md](MIGRATION_GUIDE.md)** - Migration from Google Sheets

## Testing Accounts

After setup, test with these credentials:

**Admin:**
- Email: `admin@tronxlabs.com`
- Password: `admin123`

**Employee:**
- Email: `emp1@tronxlabs.com`
- Password: `emp123`

Or create your own account via the signup page.

## Architecture

### User Authentication Flow

```
Login/Signup → Input validation → Query Supabase users table
         ↓
Password check → Session stored in localStorage → Redirect to dashboard
```

### Attendance Tracking Flow

```
Click Check-In/Out → Request browser geolocation → Get GPS coordinates
         ↓
Reverse geocode to address → Create attendance record
         ↓
Save to localStorage (offline) AND Supabase (online) → Show confirmation
```

### Data Flow

```
React Component → Services → Supabase Client → PostgreSQL Database
```

## Security Considerations

### Current Implementation
- Passwords stored as plain text (suitable for development)
- Sessions stored in localStorage
- Frontend-only authentication

### Production Recommendations

1. **Hash passwords** with bcrypt
2. **Use Supabase Auth** for better security
3. **Enable Row Level Security (RLS)** on tables
4. **Use HTTPS** only
5. **Set up CORS** properly
6. **Implement rate limiting**
7. **Add audit logging**
8. **Rotate API keys** regularly

See [SUPABASE_SETUP.md](SUPABASE_SETUP.md) for detailed security setup.

## Troubleshooting

### Common Issues

**"Cannot find module @supabase/supabase-js"**
```bash
npm install
npm run dev
```

**"Missing Supabase credentials"**
- Check `.env.local` exists
- Verify environment variables are set
- Restart dev server

**"Failed to fetch users"**
- Verify Supabase project is active
- Check users table exists in database
- See [SUPABASE_SETUP.md](SUPABASE_SETUP.md) troubleshooting

**"Location permission denied"**
- Use http://localhost (not file://)
- Grant location permission in browser
- Check browser security settings

See [SUPABASE_SETUP.md](SUPABASE_SETUP.md) and [ATTENDANCE_SETUP.md](ATTENDANCE_SETUP.md) for more troubleshooting.

## Performance

- Database queries optimized with indexes
- Geolocation requests cached
- Lazy loading of routes
- Local storage for offline support

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS Safari, Chrome Mobile)

Note: Geolocation requires HTTPS or localhost.

## Deployment

### Frontend (Vercel/Netlify)

1. Push code to GitHub
2. Connect repository to Vercel/Netlify
3. Set environment variables
4. Deploy

### Backend (Optional)

If using the backend proxy:
1. Deploy `server.js` to Heroku, Railway, or similar
2. Update `VITE_BACKEND_URL` environment variable

## Contributing

1. Create a feature branch
2. Make your changes
3. Test thoroughly
4. Submit a pull request

## License

See [LICENSE](LICENSE) file for details.

## Support

- Check documentation files first
- Review browser console for errors
- Check Supabase dashboard logs
- Open a GitHub issue with details

## Roadmap

- [ ] Supabase Auth integration
- [ ] Password hashing with bcrypt
- [ ] Row Level Security (RLS)
- [ ] Real-time sync with subscriptions
- [ ] Email notifications
- [ ] Reports and analytics dashboard
- [ ] Mobile app (React Native)
- [ ] QR code check-in

