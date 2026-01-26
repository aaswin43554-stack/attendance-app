# Firebase Authentication Setup Guide

## Overview
This project now uses **Firebase Authentication** instead of localStorage for managing logins. Firebase handles:
- Secure password hashing
- Session management with authentication tokens
- User data persistence in Firestore

## Setup Steps

### 1. Create a Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click **Create a new project**
3. Enter project name (e.g., `tronxlabs-attendance`)
4. Accept terms and click **Create project**
5. Wait for project creation to complete

### 2. Get Firebase Configuration
1. In Firebase Console, go to **Project Settings** (gear icon)
2. Scroll to **Your apps** section
3. Click **Web** icon to add a web app
4. Enter app name (e.g., `tronxlabs-web`)
5. Copy the Firebase config object
6. Update `.env.local` with these values:
```
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

### 3. Enable Authentication
1. In Firebase Console, go to **Authentication**
2. Click **Get started**
3. Enable **Email/Password** sign-in method
4. Click **Save**

### 4. Create Firestore Database
1. Go to **Firestore Database** in Firebase Console
2. Click **Create database**
3. Select **Start in test mode** (for development)
4. Choose location closest to you
5. Click **Create**

### 5. Set Up Firestore Security Rules
1. In Firestore, go to **Rules** tab
2. Replace with these rules (for development):
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can read/write their own document
    match /users/{userId} {
      allow read, write: if request.auth.uid == userId;
    }
    // Admin can read all users
    match /users/{userId} {
      allow read: if get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
  }
}
```
3. Click **Publish**

### 6. Create Admin User (Optional)
1. In Firebase Console, go to **Authentication > Users**
2. Click **Add user**
3. Enter admin email and password
4. Click **Add user**
5. Then go to **Firestore** and manually create a document:
   - Collection: `users`
   - Document ID: (copy the UID from Authentication)
   - Fields:
     ```json
     {
       "id": "uid_from_auth",
       "name": "Admin Name",
       "email": "admin@tronxlabs.com",
       "role": "admin",
       "createdAt": "2024-01-21T00:00:00.000Z"
     }
     ```

### 7. Run the Project
```bash
npm install
npm run dev
```

## How It Works

### Employee Signup
1. User enters name, phone, email, password
2. Firebase creates auth user with hashed password
3. Employee document saved to Firestore with role="employee"
4. User redirected to login page

### Employee Login
1. User enters email and password
2. Firebase verifies credentials
3. User document fetched from Firestore
4. Verified as "employee" role
5. User logged in and redirected to dashboard

### Admin Login
1. Admin enters email and password
2. Firebase verifies credentials
3. User document fetched from Firestore
4. Verified as "admin" role
5. Admin logged in and redirected to dashboard

## File Changes

- **New:** `src/services/firebase.js` - Firebase initialization
- **New:** `.env.local` - Firebase configuration (not committed to git)
- **Modified:** `src/services/auth.js` - Uses Firebase instead of localStorage
- **Modified:** `src/services/storage.js` - Session handling via Firebase
- **Modified:** Components - Made login functions async

## Security Notes

✅ **Improved:**
- Passwords are hashed by Firebase (never stored in plain text)
- Authentication tokens managed by Firebase
- Firestore rules control data access

⚠️ **Still recommended for production:**
- Add email verification
- Add password reset flow
- Implement rate limiting for failed logins
- Add 2FA support
- Move to production Firestore rules

## Troubleshooting

### Firebase config not loading
- Check `.env.local` file exists in project root
- Verify all VITE_ environment variables are set
- Restart dev server after adding `.env.local`

### User data not saving to Firestore
- Check Firestore security rules allow writes
- Verify user document structure matches code

### Login fails with "User profile not found"
- Ensure user document exists in Firestore with matching UID
- Check user has correct role field

## Resources
- [Firebase Auth Docs](https://firebase.google.com/docs/auth)
- [Firestore Docs](https://firebase.google.com/docs/firestore)
- [Vite Environment Variables](https://vitejs.dev/guide/env-and-mode.html)
