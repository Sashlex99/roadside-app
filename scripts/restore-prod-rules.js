const fs = require('fs');
const path = require('path');

const prodRules = path.join(__dirname, '..', 'firestore.rules');
const backupRules = path.join(__dirname, '..', 'firestore.rules.backup');

if (!fs.existsSync(backupRules)) {
  console.log('ℹ️  No backup found - production rules were never backed up');
  process.exit(0);
}

fs.copyFileSync(backupRules, prodRules);
console.log('✅ Restored original firestore.rules from backup');

// Clean up backup file
fs.unlinkSync(backupRules);
console.log('🗑️  Removed backup file'); 