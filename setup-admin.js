/**
 * سكريبت إنشاء حساب المدير الأول
 * يُنفذ مرة واحدة فقط ثم يُحذف
 * 
 * الاستخدام:
 *   node setup-admin.js
 * 
 * ملاحظة: هذا السكريبت يعمل من جهة العميل (Client SDK)
 *         لأن المشروع لا يستخدم Firebase Admin SDK
 */

const ADMIN_EMAIL = 'admin@doyofalharam.com';
const ADMIN_PASSWORD = 'Admin@2026#Doyof';
const ADMIN_NAME = 'المدير العام';

// Firebase config (same as in index.html)
const firebaseConfig = {
    apiKey: "AIzaSyDvSn1mrIyGG0qZ6GeKk1HQyzTv51kYxA0",
    authDomain: "studio-z3gpw.firebaseapp.com",
    projectId: "studio-z3gpw",
    storageBucket: "studio-z3gpw.firebasestorage.app",
    messagingSenderId: "481202908851",
    appId: "1:481202908851:web:cb7c537a0f3714fe7f8ac6"
};

async function setupAdmin() {
    console.log('='.repeat(50));
    console.log('  إعداد حساب المدير الأول — ضيوف الحرم');
    console.log('='.repeat(50));
    console.log('');

    // Dynamic import for ES modules
    const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js');
    const { getAuth, createUserWithEmailAndPassword } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js');
    const { getFirestore, doc, setDoc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js');

    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const db = getFirestore(app);

    try {
        console.log(`📧 إنشاء حساب: ${ADMIN_EMAIL}`);
        const userCredential = await createUserWithEmailAndPassword(auth, ADMIN_EMAIL, ADMIN_PASSWORD);
        const uid = userCredential.user.uid;
        console.log(`✅ تم إنشاء الحساب بنجاح — UID: ${uid}`);

        console.log('📝 إنشاء وثيقة المستخدم في Firestore...');
        await setDoc(doc(db, 'users', uid), {
            email: ADMIN_EMAIL,
            displayName: ADMIN_NAME,
            role: 'admin',
            isActive: true,
            createdAt: serverTimestamp(),
            createdBy: 'system-setup',
            lastLogin: null,
            permissions: {
                canDelete: true,
                canExport: true,
                canEditPrices: true,
                canManageUsers: true
            }
        });
        console.log('✅ تم إنشاء وثيقة المستخدم بنجاح');

        console.log('');
        console.log('='.repeat(50));
        console.log('  ✅ اكتمل الإعداد بنجاح!');
        console.log('='.repeat(50));
        console.log('');
        console.log('  بيانات تسجيل الدخول:');
        console.log(`  البريد: ${ADMIN_EMAIL}`);
        console.log(`  كلمة المرور: ${ADMIN_PASSWORD}`);
        console.log('');
        console.log('  ⚠️  يُرجى تغيير كلمة المرور بعد أول تسجيل دخول');
        console.log('  ⚠️  يُرجى حذف هذا الملف بعد الانتهاء');
        console.log('');
    } catch (error) {
        console.error('❌ خطأ:', error.code, error.message);
        if (error.code === 'auth/email-already-in-use') {
            console.log('ℹ️  الحساب موجود مسبقاً. يمكنك تسجيل الدخول مباشرة.');
        }
    }
}

// Note: This script should be run from index.html or a browser context
// because Firebase JS SDK requires browser APIs.
// To use, open setup-admin.html in the Electron app or a browser.
console.log('⚠️  هذا السكريبت يتطلب بيئة متصفح.');
console.log('   استخدم ملف setup-admin.html بدلاً من ذلك.');
