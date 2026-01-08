const fs = require('fs');
const path = require('path');

const devRules = path.join(__dirname, '..', 'firestore.dev.rules');
const prodRules = path.join(__dirname, '..', 'firestore.rules');
const backupRules = path.join(__dirname, '..', 'firestore.rules.backup');

if (!fs.existsSync(devRules)) {
  console.error('firestore.dev.rules not found');
  process.exit(1);
}

// Create backup of original production rules
if (fs.existsSync(prodRules) && !fs.existsSync(backupRules)) {
  fs.copyFileSync(prodRules, backupRules);
  console.log('📦 Backed up original firestore.rules');
}

fs.copyFileSync(devRules, prodRules);
console.log('✅ Copied firestore.dev.rules over firestore.rules for local use'); 