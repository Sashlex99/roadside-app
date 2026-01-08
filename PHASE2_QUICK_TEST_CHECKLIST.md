# Phase 2 Quick Test Checklist 📋

## 📱 Device Setup
- [ ] **Device A**: Client "Dave" 
- [ ] **Device B**: Client "Jon"
- [ ] **Device C**: Driver "Alice" 
- [ ] **Device D**: Driver "Bob"

---

## 🧪 Test 1: Core Race Condition
1. [ ] Alice goes online
2. [ ] Dave creates request
3. [ ] Alice bids on Dave's request
4. [ ] Jon creates identical request
5. [ ] Alice bids on Jon's request
6. [ ] **BOTH Dave & Jon click "ПРИЕМИ" simultaneously**

**Expected**: One succeeds, one fails with "driver busy" error

---

## 🧪 Test 2: Payment Protection
1. [ ] Winner from Test 1 keeps payment modal open
2. [ ] Bob bids on loser's request
3. [ ] Loser tries to accept Bob's bid
4. [ ] Should fail while payment open
5. [ ] Complete/cancel payment → retry Bob's bid
6. [ ] Should succeed after payment done

---

## 🧪 Test 3: Multiple Drivers
1. [ ] Alice & Bob both online
2. [ ] Dave creates request, both drivers bid
3. [ ] Dave accepts Alice's bid (payment opens)
4. [ ] Jon creates request, Bob bids
5. [ ] Jon accepts Bob's bid while Dave's payment still open
6. [ ] **Both should work simultaneously**

---

## 🧪 Test 4: Smart Conflicts
1. [ ] Alice bids on Dave's request
2. [ ] Alice bids on Jon's request  
3. [ ] Dave accepts & completes payment
4. [ ] Check Jon's modal - Alice's bid should disappear

---

## 🧪 Test 5: Timeout Recovery
1. [ ] Dave accepts Alice's bid (payment opens)
2. [ ] Force close Dave's app
3. [ ] Wait 6 minutes
4. [ ] Jon should be able to reserve Alice
5. [ ] System recovers automatically

---

## 🧪 Test 6: Stress Test
1. [ ] Alice bids on 3 different requests
2. [ ] All 3 clients click "ПРИЕМИ" at same time
3. [ ] Only one should succeed
4. [ ] Repeat 3 times for consistency

---

## 🔍 What to Watch
- [ ] Console logs show lock messages
- [ ] Error messages are clear
- [ ] UI updates in real-time
- [ ] No system crashes
- [ ] Performance stays good

---

## ✅ Success = All Tests Pass
**→ Phase 2 Ready for Production!** 🚀 