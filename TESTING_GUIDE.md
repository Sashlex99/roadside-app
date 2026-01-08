# 🧪 PHASE 2 TESTING GUIDE

## Prerequisites
- Admin panel running at `http://localhost:3000`
- Firebase project configured
- At least one test driver registered in mobile app

---

## TEST 1: Admin Account Setup

### 1.1 Create Admin Account (if needed)
1. Open Firebase Console: https://console.firebase.google.com
2. Select your project: `roadside-assistance-app-aa0e8`
3. Go to Authentication → Users
4. Click "Add user"
5. Enter:
   - **Email:** `admin@test.com`
   - **Password:** `admin123456`
6. Click "Add user"

### 1.2 Set Admin Role
1. Go to Firestore Database
2. Navigate to `users` collection
3. Find the admin user document (by email)
4. Edit document and add field:
   - **Field:** `role`
   - **Type:** string
   - **Value:** `admin`
5. Save changes

---

## TEST 2: Admin Login

### 2.1 Access Login Page
1. Open browser: `http://localhost:3000`
2. Should redirect to `/login`
3. ✅ **Expected:** Clean login form with "Администраторски панел" title

### 2.2 Test Login
1. Enter credentials:
   - Email: `admin@test.com`
   - Password: `admin123456`
2. Click "Влез"
3. ✅ **Expected:** Redirect to `/dashboard`
4. ❌ **If fails:** Check Firebase Console for admin user and role field

---

## TEST 3: Dashboard Functionality

### 3.1 Dashboard Layout
1. ✅ **Expected Elements:**
   - Header with "Администраторски панел"
   - "Изход" button in top-right
   - Two tabs: "Чакащи одобрение" and "Всички шофьори"
   - Driver listing (if any drivers exist)

### 3.2 Driver Display
1. Switch between tabs
2. ✅ **Expected:** 
   - Pending tab shows only `verificationStatus: 'pending'` drivers
   - All tab shows all drivers regardless of status
   - Each driver shows: name, email, company, registration date
   - Status badges (Чака/Одобрен/Отхвърлен)

### 3.3 Navigation
1. Click "Преглед" on any driver
2. ✅ **Expected:** Navigate to `/drivers/[driverId]`

---

## TEST 4: Driver Details Page

### 4.1 Driver Information Display
1. ✅ **Expected Sections:**
   - **Header:** Driver name + status badge
   - **Personal Info:** Name, email, phone, verification status, registration date
   - **Company Info:** Company name, Bulstat
   - **Documents:** Certificates, licenses, driver photo
   - **Verification Status:** Current status, date, verified by, notes
   - **Actions:** (if pending) Approve/Reject buttons

### 4.2 Document Viewing
1. Check each document section
2. ✅ **Expected:** 
   - Images display properly (base64 or URL)
   - "Няма качен документ" for missing documents
   - No Next.js image errors
   - Images scale properly (max 300px height)

### 4.3 Navigation
1. Click "← Назад"
2. ✅ **Expected:** Return to dashboard

---

## TEST 5: Approve/Reject Functionality

### 5.1 Approve Driver (if pending status)
1. Add notes in "Бележки за одобрение" (optional)
2. Click "✅ Одобри шофьора"
3. ✅ **Expected:**
   - Loading state shows "Обработва..."
   - Page refreshes with updated status
   - Status changes to "Одобрен"
   - Verification date populated
   - Notes saved
   - Actions section disappears

### 5.2 Reject Driver (create test case)
1. Register new driver in mobile app (or reset existing to pending)
2. Click "❌ Отхвърли шофьора"
3. Modal opens
4. Enter rejection reason
5. Click "Отхвърли"
6. ✅ **Expected:**
   - Status changes to "Отхвърлен"
   - Reason saved in notes
   - Modal closes

---

## TEST 6: Session Management

### 6.1 Logout
1. Click "Изход" button
2. ✅ **Expected:** Redirect to `/login`
3. ✅ **Expected:** Cannot access `/dashboard` without re-login

### 6.2 Token Persistence
1. Login successfully
2. Refresh page or close/reopen browser
3. ✅ **Expected:** Still logged in (localStorage token works)

---

## TEST 7: Error Handling

### 7.1 Invalid Login
1. Try wrong email/password
2. ✅ **Expected:** Error message displays
3. ✅ **Expected:** No redirect occurs

### 7.2 Non-Admin Login
1. Create regular user account (role: 'client' or 'driver')
2. Try to login
3. ✅ **Expected:** "Access denied" or similar error

### 7.3 Network Errors
1. Disconnect internet briefly
2. Try to approve/reject driver
3. ✅ **Expected:** Appropriate error message

---

## TESTING CHECKLIST

### Core Functionality
- [ ] Admin login works
- [ ] Dashboard displays drivers correctly
- [ ] Driver details page shows all information
- [ ] Documents display without errors
- [ ] Approve functionality works
- [ ] Reject functionality works
- [ ] Navigation works properly
- [ ] Logout works

### UI/UX
- [ ] Responsive design on different screen sizes
- [ ] Loading states show during API calls
- [ ] Error messages are user-friendly
- [ ] Status badges display correctly
- [ ] Forms validation works

### Edge Cases
- [ ] Empty state (no drivers)
- [ ] Missing documents
- [ ] Invalid image data
- [ ] Network failures
- [ ] Invalid tokens

---

## COMMON ISSUES & SOLUTIONS

### Issue: "Invalid admin token"
**Solution:** Check if admin user has `role: 'admin'` field in Firestore

### Issue: Images not displaying
**Solution:** Check if documents contain valid base64 or URL data

### Issue: Dashboard empty
**Solution:** Register test drivers in mobile app first

### Issue: Cannot approve/reject
**Solution:** Verify admin account has proper permissions and user exists

---

## TEST DATA SETUP

Need test drivers? Run the mobile app and register with:
- **Driver 1:** driver1@test.com / password123
- **Driver 2:** driver2@test.com / password123

Make sure to:
1. Select "Шофьор" user type
2. Complete all required fields
3. Upload test documents (photos)
4. Verify phone number

---

*Testing should take approximately 15-20 minutes for complete coverage* 