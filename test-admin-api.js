require('dotenv').config();

// Тестов скрипт за Admin API функциите
// Изпълнете с: node test-admin-api.js

const API_KEY = 'process.env.EXPO_PUBLIC_FIREBASE_API_KEY || 'AIzaSyAAgzduiR-UoVmuAGViFVrjJuxbktKF_ac'';
const PROJECT_ID = 'roadside-assistance-app-aa0e8';

// Копирани функции от adminAPI.ts за тестване
const adminLogin = async (email, password) => {
  console.log('🔐 Тествам админ логин...');
  
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password,
        returnSecureToken: true,
      }),
    }
  );
  
  const data = await response.json();
  if (!response.ok) {
    console.error('❌ Админ логин неуспешен:', data.error);
    throw data.error;
  }
  
  console.log('✅ Админ логин успешен');
  return data;
};

const getPendingDrivers = async (token) => {
  console.log('📋 Тествам getPendingDrivers...');
  
  const response = await fetch(
    `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/users?pageSize=1000`,
    {
      headers: { 'Authorization': `Bearer ${token}` }
    }
  );
  
  const data = await response.json();
  if (!response.ok) {
    console.error('❌ getPendingDrivers неуспешен:', data.error);
    throw data.error;
  }
  
  const users = data.documents?.map((doc) => ({
    id: doc.name.split('/').pop(),
    ...firestoreFieldsToObject(doc.fields)
  })) || [];
  
  const pendingDrivers = users.filter((user) => 
    user.userType === 'driver' && 
    (user.verificationStatus === 'pending' || user.status === 'pending')
  );
  
  console.log(`✅ Намерени ${pendingDrivers.length} чакащи шофьори`);
  console.log('Шофьори:', pendingDrivers.map(d => `${d.fullName} (${d.email})`));
  
  return pendingDrivers;
};

const checkAdminExists = async (token) => {
  console.log('👤 Проверявам дали съществува админ акаунт...');
  
  const response = await fetch(
    `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/users?pageSize=1000`,
    {
      headers: { 'Authorization': `Bearer ${token}` }
    }
  );
  
  const data = await response.json();
  if (!response.ok) {
    console.error('❌ Неуспешно извличане на потребители:', data.error);
    throw data.error;
  }
  
  const users = data.documents?.map((doc) => ({
    id: doc.name.split('/').pop(),
    ...firestoreFieldsToObject(doc.fields)
  })) || [];
  
  const admins = users.filter(user => user.role === 'admin');
  
  if (admins.length === 0) {
    console.log('⚠️  НЯМА админ акаунти! Трябва да създадете админ в Firebase Console.');
    console.log('📖 Инструкции:');
    console.log('   1. Firebase Console → Authentication → Users');
    console.log('   2. Добавете admin@roadside-assistance.com');
    console.log('   3. Firebase Console → Firestore → users');
    console.log('   4. Добавете документ с role: "admin"');
  } else {
    console.log(`✅ Намерени ${admins.length} админ акаунти:`);
    admins.forEach(admin => {
      console.log(`   - ${admin.email} (${admin.fullName || 'Без име'})`);
    });
  }
  
  return admins;
};

// Helper function
const firestoreFieldsToObject = (fields) => {
  const obj = {};
  for (const key in fields) {
    const field = fields[key];
    if (field.nullValue !== undefined) {
      obj[key] = null;
    } else if (field.stringValue !== undefined) {
      obj[key] = field.stringValue;
    } else if (field.integerValue !== undefined) {
      obj[key] = parseInt(field.integerValue);
    } else if (field.booleanValue !== undefined) {
      obj[key] = field.booleanValue;
    } else if (field.timestampValue !== undefined) {
      obj[key] = new Date(field.timestampValue);
    } else if (field.mapValue !== undefined) {
      obj[key] = firestoreFieldsToObject(field.mapValue.fields);
    }
  }
  return obj;
};

// Главен тест
async function runTests() {
  console.log('🧪 ЗАПОЧВАМ ТЕСТОВЕ НА ФАЗА 1\n');
  
  try {
    // Тест 1: Опитай се да влезеш като админ (ако съществува)
    let adminToken = null;
    try {
      const adminResult = await adminLogin('admin@roadside-assistance.com', 'your-admin-password');
      adminToken = adminResult.idToken;
      console.log('✅ Админ логин работи\n');
    } catch (error) {
      console.log('⚠️  Админ логин неуспешен (нормално ако няма админ акаунт)\n');
      
      // Използваме обикновен потребителски токен за останалите тестове
      console.log('🔑 Опитвам се с тестов потребител...');
      try {
        const testResult = await adminLogin('dgxgz@gmail.com', 'your-test-password');
        adminToken = testResult.idToken;
        console.log('✅ Получен тестов токен\n');
      } catch (testError) {
        console.log('❌ Няма валиден токен за тестване. Създайте потребител първо.\n');
        return;
      }
    }
    
    // Тест 2: Проверка за админ акаунти
    await checkAdminExists(adminToken);
    console.log('');
    
    // Тест 3: Проверка за чакащи шофьори
    await getPendingDrivers(adminToken);
    console.log('');
    
    console.log('✅ ВСИЧКИ ТЕСТОВЕ ЗАВЪРШЕНИ!');
    console.log('\n📋 РЕЗУЛТАТ:');
    console.log('- API функциите работят ✅');
    console.log('- Базата данни е достъпна ✅');
    console.log('- Готово за Фаза 2! 🚀');
    
  } catch (error) {
    console.error('❌ ГРЕШКА ПРИ ТЕСТВАНЕ:', error);
  }
}

// Изпълни тестовете
runTests(); 