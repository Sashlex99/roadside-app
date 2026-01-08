# Admin Panel Setup & Troubleshooting Guide

## ✅ Step 1: Environment Configuration (COMPLETED)
I've created the necessary `.env.local` file in the `admin-panel` directory with:
```
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyAAgzduiR-UoVmuAGViFVrjJuxbktKF_ac
NEXT_PUBLIC_FIREBASE_PROJECT_ID=roadside-assistance-app-aa0e8
```

## 🚀 Step 2: Start the Admin Panel
The admin panel should now be running at: **http://localhost:3000**

If it's not running, navigate to the admin panel directory and start it:
```bash
cd admin-panel
npm install  # if dependencies are not installed
npm run dev
```

## 👤 Step 3: Create an Admin User Account

### Option A: Use an existing account
1. If you have registered as a client or driver in the mobile app, you can convert that account to admin:
   - Go to Firebase Console > Firestore > `users` collection
   - Find your user document
   - Change the `role` field from `"client"` or `"driver"` to `"admin"`

### Option B: Register a new account specifically for admin
1. Register as a **client** (not driver) in the mobile app
2. Use a dedicated admin email like `admin@yourcompany.com`
3. After registration, update the user in Firestore to have `role: "admin"`

## 🔍 Step 4: Test Driver Registration

### To test if drivers appear in admin panel:
1. **Register as a driver** using the mobile app:
   - Use driver registration form
   - Fill in company info (name, bulstat)
   - Upload required documents (roadside certificate, IAALA license, driver photo)
   - Complete phone verification

2. **Check Firestore** to verify the driver was saved:
   - Firebase Console > Firestore > `users` collection
   - Look for a document with:
     ```json
     {
       "userType": "driver",
       "verificationStatus": "pending",
       "companyInfo": { "name": "...", "bulstat": "..." },
       "documents": { ... },
       "email": "driver@email.com"
     }
     ```

3. **Login to admin panel** and check the dashboard
   - Should see the driver in "Pending Drivers" tab

## 🛠️ Troubleshooting

### Issue: "Firebase API key is not configured"
- **Cause**: Missing `.env.local` file
- **Solution**: Already fixed ✅

### Issue: "Invalid admin token or insufficient privileges"
- **Cause**: Your user account doesn't have `role: "admin"`
- **Solution**: Update your user document in Firestore to have `role: "admin"`

### Issue: "No pending drivers" showing
- **Cause**: Either no drivers registered, or they're not saving correctly
- **Solutions**:
  1. Register as a driver first using the mobile app
  2. Check Firebase Console > Firestore > `users` collection to verify drivers exist
  3. Check browser console for JavaScript errors

### Issue: Admin panel won't start
- **Cause**: Dependencies not installed or port conflict
- **Solutions**:
  ```bash
  cd admin-panel
  npm install
  npm run dev
  ```

## 📋 Admin Panel Features

Once logged in, you can:
- **View pending drivers** waiting for approval
- **Approve/reject drivers** with notes
- **View all drivers** (approved, pending, rejected)
- **Manage clients** and view client details
- **Ban/unban users** if needed
- **View admin action history**

## 🔐 Security Notes

- The admin panel uses Firebase Authentication with REST API
- Only users with `role: "admin"` can access admin functions
- All admin actions are logged in the `adminActions` collection
- Environment variables are secure and not exposed to the client

## 📞 Next Steps

1. **Test the admin panel** at http://localhost:3000
2. **Login with your admin credentials**
3. **Register as a driver** using the mobile app to test the flow
4. **Verify drivers appear** in the admin panel dashboard

If you still don't see drivers after following these steps, please:
1. Check the browser console for error messages
2. Verify in Firebase Console that drivers are actually being saved
3. Confirm your admin user has the correct `role: "admin"` 