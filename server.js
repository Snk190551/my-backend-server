// นำเข้า Library ที่จำเป็น
const express = require('express'); // Framework สำหรับสร้าง Web Server
const cors = require('cors'); // Middleware สำหรับจัดการ Cross-Origin Resource Sharing (CORS)
const nodemailer = require('nodemailer'); // Library สำหรับส่งอีเมล
const bodyParser = require('body-parser'); // Middleware สำหรับ Parse Request Body (เช่น JSON)
const admin = require('firebase-admin'); // Firebase Admin SDK สำหรับเชื่อมต่อกับ Firestore
const bcrypt = require('bcrypt'); // Library สำหรับเข้ารหัสรหัสผ่าน (password hashing)

const app = express(); // สร้าง Instance ของ Express Application
const port = process.env.PORT || 3000; // กำหนด Port ที่ Backend Server จะทำงาน (ใช้จาก Environment Variable ของ Render ถ้ามี หรือ 3000)

// Middleware:
// อนุญาตให้ Frontend สามารถส่ง Request มายัง Backend ได้ (สำคัญมากสำหรับ CORS)
// กำหนดค่า CORS ให้ชัดเจนเพื่ออนุญาต Frontend ของคุณ
app.use(cors({
    origin: 'https://matherror.netlify.app', // อนุญาตเฉพาะ Frontend URL ของคุณ
    methods: ['GET', 'POST', 'PUT', 'DELETE'], // อนุญาต Method ที่จำเป็น
    allowedHeaders: ['Content-Type', 'Authorization'] // อนุญาต Header ที่จำเป็น
}));
// ใช้ body-parser สำหรับแปลง Request Body ที่เป็น JSON
app.use(bodyParser.json());

// กำหนดค่า bcrypt: saltRounds คือความซับซ้อนในการเข้ารหัส ยิ่งสูงยิ่งปลอดภัย แต่ใช้เวลานานขึ้น
const saltRounds = 10;

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

// กำหนดค่า Nodemailer transporter: สำหรับส่งอีเมล
// ดึงค่า EMAIL_USER และ EMAIL_PASS จาก Environment Variables ที่คุณจะตั้งค่าใน Render
const transporter = nodemailer.createTransport({
    service: 'gmail', // ใช้ Gmail เป็นบริการส่งอีเมล
    auth: {
        user: process.env.EMAIL_USER, // อีเมลผู้ส่ง
        pass: process.env.EMAIL_PASS  // App Password ของ Gmail
    }
});

// ************ Routes (เส้นทาง API) ************

// Route สำหรับ Home Page (เมื่อเข้าถึง URL หลักของ Backend Server)
app.get('/', (req, res) => {
  res.send('Hello from Backend Server!');
});

// Route สำหรับการลงทะเบียนผู้ใช้ใหม่
app.post('/api/register', async (req, res) => {
  // ดึง username, email, password จาก Request Body
  const { username, email, password } = req.body;
  console.log(`Received registration: User=${username}, Email=${email}, Pass=${password ? '*****' : 'N/A'}`); // ซ่อนรหัสผ่านใน Log เพื่อความปลอดภัย

  // ตรวจสอบข้อมูลเบื้องต้น
  if (!username || !email || !password) {
    return res.status(400).json({ message: 'โปรดกรอกข้อมูลให้ครบถ้วน: ชื่อผู้ใช้, อีเมล, รหัสผ่าน.' });
  }
  // ตรวจสอบความยาวรหัสผ่าน
  if (password.length < 6) {
      return res.status(400).json({ message: 'รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร.' });
  }

  try {
    // 1. ตรวจสอบว่าชื่อผู้ใช้ซ้ำหรือไม่ใน Collection 'users'
    const userRef = db.collection('users').doc(username); // ใช้ username เป็น Document ID ใน Firestore
    const userDoc = await userRef.get();
    if (userDoc.exists) {
      return res.status(409).json({ message: 'ชื่อผู้ใช้นี้ถูกใช้ไปแล้ว' });
    }

    // 2. ตรวจสอบว่าอีเมลซ้ำหรือไม่ใน Collection 'users'
    const emailQuery = await db.collection('users').where('email', '==', email).limit(1).get();
    if (!emailQuery.empty) {
      return res.status(409).json({ message: 'อีเมลนี้ถูกใช้ไปแล้ว' });
    }

    // 3. เข้ารหัสรหัสผ่านด้วย bcrypt ก่อนบันทึก
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // 4. บันทึกข้อมูลผู้ใช้ลงใน Firestore
    await userRef.set({
      username: username,
      email: email,
      password: hashedPassword, // เก็บเฉพาะรหัสผ่านที่เข้ารหัสแล้ว
      createdAt: admin.firestore.FieldValue.serverTimestamp() // บันทึกเวลาที่สร้างบัญชี
    });

    // ส่งการตอบกลับว่าสมัครสมาชิกสำเร็จ
    res.status(201).json({ message: 'สมัครสมาชิกสำเร็จ! โปรดเข้าสู่ระบบ' });
  } catch (error) {
    console.error('Error during registration:', error);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการสมัครสมาชิก. โปรดลองใหม่อีกครั้ง.' });
  }
});

// Route สำหรับการเข้าสู่ระบบผู้ใช้
app.post('/api/login', async (req, res) => {
  // ดึง username (หรือ email) และ password จาก Request Body
  const { username, password } = req.body;
  console.log(`Login attempt: User=${username}, Pass=${password ? '*****' : 'N/A'}`); // ซ่อนรหัสผ่านใน Log

  // ตรวจสอบข้อมูลเบื้องต้น
  if (!username || !password) {
    return res.status(400).json({ message: 'โปรดกรอกชื่อผู้ใช้และรหัสผ่าน.' });
  }

  try {
    // 1. ค้นหาผู้ใช้ใน Firestore ด้วย username หรือ email
    let userDoc;
    // ลองค้นหาด้วย username ก่อน (ซึ่งเป็น Document ID)
    const userByUsername = await db.collection('users').doc(username).get();
    if (userByUsername.exists) {
        userDoc = userByUsername;
    } else {
        // ถ้าไม่เจอด้วย username ลองค้นหาด้วย email
        const userByEmailQuery = await db.collection('users').where('email', '==', username).limit(1).get();
        if (!userByEmailQuery.empty) {
            userDoc = userByEmailQuery.docs[0];
        }
    }

    // ถ้าไม่พบผู้ใช้
    if (!userDoc || !userDoc.exists) {
      return res.status(401).json({ message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
    }

    const userData = userDoc.data();
    const hashedPassword = userData.password; // รหัสผ่านที่เข้ารหัสจากฐานข้อมูล

    // 2. เปรียบเทียบรหัสผ่านที่กรอกเข้ามากับรหัสผ่านที่เข้ารหัสในฐานข้อมูล
    const passwordMatch = await bcrypt.compare(password, hashedPassword);

    if (passwordMatch) {
      // เข้าสู่ระบบสำเร็จ
      // ในแอปพลิเคชันจริง: ควรสร้าง JWT (JSON Web Token) และส่งกลับไปให้ Frontend เพื่อจัดการ Session ที่ปลอดภัยกว่า
      res.status(200).json({ message: 'เข้าสู่ระบบสำเร็จ!', username: userData.username });
    } else {
      // รหัสผ่านไม่ถูกต้อง
      res.status(401).json({ message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
    }
  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ. โปรดลองใหม่อีกครั้ง.' });
  }
});

// Route สำหรับการลืมรหัสผ่าน (ส่งลิงก์รีเซ็ตไปยังอีเมล)
app.post('/api/forgot-password', async (req, res) => {
    const { email } = req.body;
    console.log(`Received forgot password request for: ${email}`);

    if (!email) {
        return res.status(400).json({ message: 'โปรดกรอกอีเมลของคุณ.' });
    }

    try {
        // 1. ตรวจสอบว่าอีเมลมีอยู่ในฐานข้อมูลจริงหรือไม่
        const userQuery = await db.collection('users').where('email', '==', email).limit(1).get();
        if (userQuery.empty) {
            // เพื่อความปลอดภัย: ไม่ควรบอกว่าอีเมลนี้ไม่มีอยู่ในระบบ เพื่อป้องกันการคาดเดาอีเมล
            return res.status(200).json({ message: 'หากอีเมลนี้มีอยู่ในระบบ ลิงก์สำหรับรีเซ็ตรหัสผ่านได้ถูกส่งไปแล้วค่ะ' });
        }

        const userDoc = userQuery.docs[0];
        const userId = userDoc.id; // username ของผู้ใช้
        const username = userDoc.data().username;

        // 2. สร้าง Reset Token ที่ปลอดภัยและมีวันหมดอายุ
        const resetToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        const expiresAt = new Date(Date.now() + 3600000); // Token หมดอายุใน 1 ชั่วโมง (3600000 มิลลิวินาที)

        // 3. บันทึก Token ลงในฐานข้อมูล Firestore (Collection 'passwordResetTokens')
        await db.collection('passwordResetTokens').doc(resetToken).set({
            userId: userId,
            email: email,
            expiresAt: expiresAt,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            used: false // สถานะว่า Token ถูกใช้ไปแล้วหรือยัง
        });

        // 4. สร้างลิงก์รีเซ็ต
        // **สำคัญ:** เปลี่ยน 'https://matherror.netlify.app/' เป็น URL จริงของ Frontend ของคุณที่ได้จาก Netlify
        const resetLink = `https://matherror.netlify.app/reset.html?token=${resetToken}`;

        // กำหนดรายละเอียดอีเมลที่จะส่ง
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'คำขอรีเซ็ตรหัสผ่านของคุณ',
            html: `
                <p>เรียนคุณ ${username},</p>
                <p>คุณได้ส่งคำขอรีเซ็ตรหัสผ่านสำหรับบัญชีของคุณ</p>
                <p>กรุณาคลิกลิงก์นี้เพื่อตั้งรหัสผ่านใหม่: <a href="${resetLink}">${resetLink}</a></p>
                <p>ลิงก์นี้จะหมดอายุใน 1 ชั่วโมง</p>
                <p>หากคุณไม่ได้ร้องขอการรีเซ็ตนี้ โปรดละเว้นอีเมลนี้</p>
            `
        };

        // ส่งอีเมล
        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.error('Error sending email:', error);
                return res.status(500).json({ message: 'เกิดข้อผิดพลาดในการส่งอีเมล. โปรดลองใหม่อีกครั้ง.' });
            } else {
                console.log('Email sent: ' + info.response);
                return res.status(200).json({ message: 'หากอีเมลนี้มีอยู่ในระบบ ลิงก์สำหรับรีเซ็ตรหัสผ่านได้ถูกส่งไปแล้วค่ะ' });
            }
        });
    } catch (error) {
        console.error('Error during forgot password request:', error);
        res.status(500).json({ message: 'เกิดข้อผิดพลาดในการประมวลผลคำขอ. โปรดลองใหม่อีกครั้ง.' });
    }
});

// Route สำหรับการตั้งรหัสผ่านใหม่ (เมื่อผู้ใช้คลิกลิงก์รีเซ็ตและกรอกรหัสผ่านใหม่)
app.post('/api/reset-password', async (req, res) => {
    const { token, newPassword } = req.body;
    console.log(`Received password reset request for token: ${token}, New password: ${newPassword ? '*****' : 'N/A'}`); // ซ่อนรหัสผ่านใน Log

    // ตรวจสอบข้อมูลเบื้องต้น
    if (!token || !newPassword || newPassword.length < 6) { // รหัสผ่านขั้นต่ำ 6 ตัวอักษร
        return res.status(400).json({ message: 'ข้อมูลไม่ถูกต้อง. โปรดตรวจสอบ Token และรหัสผ่านใหม่ (อย่างน้อย 6 ตัวอักษร).' });
    }

    try {
        // 1. ตรวจสอบ Token ใน Firestore
        const tokenRef = db.collection('passwordResetTokens').doc(token);
        const tokenDoc = await tokenRef.get();

        // ถ้าไม่พบ Token
        if (!tokenDoc.exists) {
            return res.status(400).json({ message: 'Token ไม่ถูกต้องหรือไม่พบ.' });
        }

        const tokenData = tokenDoc.data();
        // ถ้า Token ถูกใช้ไปแล้ว
        if (tokenData.used) {
            return res.status(400).json({ message: 'Token นี้ถูกใช้ไปแล้ว.' });
        }
        // ถ้า Token หมดอายุแล้ว (เปรียบเทียบ Firestore Timestamp กับเวลาปัจจุบัน)
        if (tokenData.expiresAt.toDate() < new Date()) {
            return res.status(400).json({ message: 'Token หมดอายุแล้ว.' });
        }

        // 2. ค้นหาผู้ใช้ที่เกี่ยวข้องกับ Token (ใช้ userId ที่เก็บใน Token)
        const userRef = db.collection('users').doc(tokenData.userId); // userId คือ username
        const userDoc = await userRef.get();

        // ถ้าไม่พบผู้ใช้
        if (!userDoc.exists) {
            return res.status(404).json({ message: 'ไม่พบผู้ใช้ที่เกี่ยวข้องกับ Token นี้.' });
        }

        // 3. เข้ารหัสรหัสผ่านใหม่
        const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

        // 4. อัปเดตรหัสผ่านของผู้ใช้ในฐานข้อมูล
        await userRef.update({
            password: hashedPassword,
            updatedAt: admin.firestore.FieldValue.serverTimestamp() // บันทึกเวลาที่อัปเดต
        });

        // 5. ทำเครื่องหมายว่า Token ถูกใช้แล้ว เพื่อป้องกันการใช้ซ้ำ
        await tokenRef.update({
            used: true,
            usedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        res.status(200).json({ message: 'รีเซ็ตรหัสผ่านสำเร็จ!' });
    } catch (error) {
        console.error('Error during password reset:', error);
        res.status(500).json({ message: 'เกิดข้อผิดพลาดในการรีเซ็ตรหัสผ่าน. โปรดลองใหม่อีกครั้ง.' });
    }
});

// Route สำหรับ Admin: ดึงข้อมูลผู้ใช้ทั้งหมด
// **คำเตือน:** ในแอปพลิเคชันจริง ควรมีการยืนยันตัวตนสำหรับ Admin ที่เข้มงวดกว่านี้ (เช่น JWT พร้อม Role-based access control)
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
// **คำเตือน:** ในแอปพลิเคชันจริง ควรมีการยืนยันตัวตนสำหรับ Admin ที่เข้มงวดกว่านี้
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
