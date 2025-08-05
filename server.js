// นำเข้า Library ที่จำเป็น
const express = require('express'); // Framework สำหรับสร้าง Web Server
const cors = require('cors'); // Middleware สำหรับจัดการ Cross-Origin Resource Sharing (CORS)
const bodyParser = require('body-parser'); // Middleware สำหรับ Parse Request Body (เช่น JSON)
const admin = require('firebase-admin'); // Firebase Admin SDK สำหรับเชื่อมต่อกับ Firestore

const app = express(); // สร้าง Instance ของ Express Application
const port = process.env.PORT || 3000; // กำหนด Port ที่ Backend Server จะทำงาน (ใช้จาก Environment Variable ของ Render ถ้ามี หรือ 3000)

// Middleware:
// อนุญาตให้ Frontend สามารถส่ง Request มายัง Backend ได้ (สำคัญมากสำหรับ CORS)
app.use(cors());
// ใช้ body-parser สำหรับแปลง Request Body ที่เป็น JSON
app.use(bodyParser.json());

// กำหนดค่า Firebase Admin SDK: เชื่อมต่อกับ Google Cloud Firestore
// ดึง Service Account Key จาก Environment Variable ที่คุณจะตั้งค่าใน Render
try {
    // ตรวจสอบว่า Environment Variable FIREBASE_SERVICE_ACCOUNT_KEY มีอยู่จริง
    if (!process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
        console.error('FIREBASE_SERVICE_ACCOUNT_KEY environment variable is not set.');
        // ถ้าไม่มี key จะหยุดแอปพลิเคชันทันที เพราะไม่สามารถเชื่อมต่อ Firestore ได้
        process.exit(1);
    }
    // Parse JSON string ของ Service Account Key จาก Environment Variable
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    // เริ่มต้น Firebase Admin SDK ด้วย Service Account Key
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
    console.log('Firebase Admin SDK initialized successfully.');
} catch (error) {
    console.error('Failed to initialize Firebase Admin SDK. Check FIREBASE_SERVICE_ACCOUNT_KEY format or content:', error);
    process.exit(1); // หยุดแอปพลิเคชันถ้า Firebase Init ล้มเหลว
}

// สร้าง Instance ของ Firestore Database
const db = admin.firestore();

// ************ Routes (เส้นทาง API) ************

// Route สำหรับ Home Page (เมื่อเข้าถึง URL หลักของ Backend Server)
app.get('/', (req, res) => {
  res.send('Hello from Backend Server! This backend is ready for expense tracking.');
});

// API สำหรับจัดการข้อมูลรายรับ-รายจ่าย
// ดึงรายการรายรับ-รายจ่ายสำหรับผู้ใช้
app.get('/api/transactions/:userId', async (req, res) => {
    const userId = req.params.userId;
    try {
        // ดึงข้อมูลจาก Collection 'transactions' ที่เป็นของ userId นี้
        // สามารถเพิ่ม filter หรือ order by ได้ในอนาคต
        const transactionsSnapshot = await db.collection('transactions').where('userId', '==', userId).orderBy('date', 'desc').get();
        const transactions = transactionsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            date: doc.data().date.toDate() // แปลง Timestamp กลับเป็น Date object
        }));
        res.status(200).json(transactions);
    } catch (error) {
        console.error('Error fetching transactions:', error);
        res.status(500).json({ message: 'เกิดข้อผิดพลาดในการดึงข้อมูลรายการ.' });
    }
});

// เพิ่มรายการรายรับ-รายจ่ายใหม่
app.post('/api/transactions', async (req, res) => {
    const { userId, amount, category, type, date, description, account } = req.body;
    if (!userId || !amount || !category || !type || !date || !account) {
        return res.status(400).json({ message: 'โปรดระบุข้อมูลที่จำเป็นให้ครบถ้วน (userId, amount, category, type, date, account).' });
    }
    try {
        const newTransactionRef = await db.collection('transactions').add({
            userId,
            amount: parseFloat(amount), // แปลงเป็นตัวเลข
            category,
            type, // 'expense' หรือ 'income'
            date: new Date(date), // แปลงเป็น Timestamp
            description: description || '',
            account // เช่น 'เงินสด', 'บัญชีธนาคาร', 'บัตรเครดิต'
        });
        res.status(201).json({ message: 'เพิ่มรายการสำเร็จ', id: newTransactionRef.id });
    } catch (error) {
        console.error('Error adding transaction:', error);
        res.status(500).json({ message: 'เกิดข้อผิดพลาดในการเพิ่มรายการ.' });
    }
});

// *** API สำหรับ Admin (นำกลับมาตามคำขอ) ***
// Route สำหรับ Admin: ดึงข้อมูลผู้ใช้ทั้งหมด
app.get('/api/admin/users', async (req, res) => {
    try {
        const usersSnapshot = await db.collection('users').get();
        const users = usersSnapshot.docs.map(doc => ({
            id: doc.id, // Document ID (ซึ่งคือ username)
            ...doc.data() // ข้อมูลอื่นๆ ของผู้ใช้
        }));
        // ไม่ควรส่งรหัสผ่านที่เข้ารหัสกลับไป Frontend โดยตรงเพื่อความปลอดภัย
        const safeUsers = users.map(({ password, ...rest }) => rest); // กรอง field 'password' ออก
        res.status(200).json(safeUsers);
    } catch (error) {
        console.error('Error fetching users for admin:', error);
        res.status(500).json({ message: 'เกิดข้อผิดพลาดในการดึงข้อมูลผู้ใช้.' });
    }
});

// Route สำหรับ Admin: ลบผู้ใช้
app.post('/api/admin/delete-user', async (req, res) => {
    const { username } = req.body;
    if (!username) {
        return res.status(400).json({ message: 'โปรดระบุชื่อผู้ใช้ที่จะลบ.' });
    }
    try {
        // ลบ Document ผู้ใช้จาก Collection 'users'
        await db.collection('users').doc(username).delete();
        
        // ลบ Token สำหรับรีเซ็ตรหัสผ่านที่เกี่ยวข้องกับผู้ใช้นี้ด้วย (ถ้ามี)
        const tokensToDelete = await db.collection('passwordResetTokens').where('userId', '==', username).get();
        const batch = db.batch(); // ใช้ Batch Write เพื่อลบหลาย Document พร้อมกัน
        tokensToDelete.docs.forEach((doc) => {
            batch.delete(doc.ref);
        });
        await batch.commit(); // ยืนยันการลบทั้งหมด

        res.status(200).json({ message: `ลบผู้ใช้ ${username} สำเร็จแล้ว.` });
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ message: 'เกิดข้อผิดพลาดในการลบผู้ใช้.' });
    }
});


// ************ เริ่ม Server ************
app.listen(port, () => {
  console.log(`Backend server listening at http://localhost:${port}`);
  console.log('You can now make requests to this server from your frontend.');
});
