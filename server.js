const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer'); // นำเข้า Nodemailer
const bodyParser = require('body-parser'); // นำเข้า body-parser

const app = express(); // สร้าง Instance ของ Express Application
const port = 3000; // กำหนด Port ที่ Backend Server จะทำงาน

// Middleware:
// อนุญาตให้ Frontend สามารถส่ง Request มายัง Backend ได้ (สำคัญมากสำหรับ CORS)
app.use(cors());

// ใช้ body-parser สำหรับแปลง Request Body ที่เป็น JSON
app.use(bodyParser.json());
// หรือถ้า Express เวอร์ชันใหม่รองรับ:
// app.use(express.json());

// กำหนดค่า Nodemailer transporter
// ดึงค่าจาก Environment Variables ที่คุณจะตั้งค่าใน Render
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER, // ดึงจาก Environment Variable ชื่อ EMAIL_USER
        pass: process.env.EMAIL_PASS  // ดึงจาก Environment Variable ชื่อ EMAIL_PASS
    }
});

// ************ Routes (เส้นทาง API) ************

// Route สำหรับ Home Page (เมื่อเข้าถึง http://localhost:3000/)
app.get('/', (req, res) => {
  res.send('Hello from Backend Server!');
});

// Route สำหรับการลงทะเบียน
app.post('/api/register', (req, res) => {
  const { username, password } = req.body;
  console.log(`Received registration: User=${username}, Pass=${password}`);

  // *** ในส่วนนี้คือ Logic จริงๆ ที่ Backend ต้องทำ: ***
  // 1. ตรวจสอบข้อมูล (Validation)
  // 2. เข้ารหัสรหัสผ่าน (Hash password) ก่อนเก็บ (สำคัญมาก!)
  // 3. บันทึกข้อมูลผู้ใช้ลงฐานข้อมูล
  // 4. ส่งสถานะการตอบกลับไป Frontend
  // *************************************************

  res.status(200).json({ message: 'Registration request received. (Need database integration)' });
});

// Route สำหรับการเข้าสู่ระบบ
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  console.log(`Login attempt: User=${username}, Pass=${password}`);

  // *** ส่วนนี้คือส่วนที่คุณจะต้องเชื่อมต่อกับฐานข้อมูลจริง ***
  // ตัวอย่างง่ายๆ: ตอนนี้เราแค่ตอบกลับสำเร็จเสมอ
  // ในอนาคตคุณต้องตรวจสอบ username/password กับฐานข้อมูล
  if (username && password) { // ตรวจสอบว่ามีข้อมูลส่งมา
    // สมมติว่ามีผู้ใช้ชื่อ 'admin' รหัส 'admin' เพื่อทดสอบ login admin
    if (username === 'admin' && password === 'admin') {
      return res.status(200).json({ message: 'Login successful (Admin).' });
    }
    // สำหรับผู้ใช้ทั่วไป สมมติว่าทุก Username/Password ที่ไม่ว่างเปล่าคือ login ได้
    // *** สำคัญ: ในแอปจริง ต้องตรวจสอบกับฐานข้อมูลและ Hash Password ด้วย ***
    return res.status(200).json({ message: 'Login successful.' });
  } else {
    return res.status(400).json({ message: 'Username and password are required.' });
  }
});

// Route สำหรับการลืมรหัสผ่าน (พร้อมส่งอีเมลด้วย Nodemailer)
app.post('/api/forgot-password', (req, res) => {
    const { email } = req.body; // ตัวแปร 'email' ถูกประกาศและมีค่าตรงนี้
    console.log(`Received forgot password request for: ${email}`);

    // *** 1. ตรวจสอบว่าอีเมลมีอยู่ในฐานข้อมูลจริงหรือไม่ ***
    // ในแอปจริง: คุณต้องค้นหาผู้ใช้ด้วยอีเมลนี้ในฐานข้อมูลของคุณ
    const userExists = true; // สมมติว่ามีผู้ใช้เสมอเพื่อทดสอบการส่งอีเมล

    if (!userExists) {
        // เพื่อความปลอดภัย ไม่ควรบอกว่าอีเมลนี้ไม่มีอยู่ในระบบ
        return res.status(200).json({ message: 'หากอีเมลนี้มีอยู่ในระบบ ลิงก์สำหรับรีเซ็ตรหัสผ่านได้ถูกส่งไปแล้วค่ะ' });
    }

    // *** 2. สร้าง Reset Token (ในอนาคต: จะต้องเก็บ Token นี้ไว้ในฐานข้อมูลด้วย) ***
    const resetToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    // ในแอปจริง: คุณจะสร้าง token ที่ปลอดภัยกว่านี้ (เช่น UUID หรือ JWT) และเก็บพร้อมวันหมดอายุใน DB

    // สร้างลิงก์รีเซ็ต
    // **สำคัญ:** เปลี่ยน 'https://matherror.netlify.app/' เป็น URL จริงของ Frontend ของคุณที่ได้จาก Netlify
    // ตรวจสอบให้แน่ใจว่าไม่มี // ซ้ำกัน
    const resetLink = `https://matherror.netlify.app/reset.html?token=${resetToken}`;

    // *** โค้ด mailOptions และ transporter.sendMail() ต้องอยู่ตรงนี้ ***
    const mailOptions = {
        from: process.env.EMAIL_USER, // ดึงจาก Environment Variable
        to: email, // ตอนนี้ 'email' มีค่าแล้ว
        subject: 'คำขอรีเซ็ตรหัสผ่านของคุณ',
        html: `
            <p>คุณได้ส่งคำขอรีเซ็ตรหัสผ่านสำหรับบัญชีของคุณ</p>
            <p>กรุณาคลิกลิงก์นี้เพื่อตั้งรหัสผ่านใหม่: <a href="${resetLink}">${resetLink}</a></p>
            <p>ลิงก์นี้จะหมดอายุภายในเวลาอันสั้น</p>
            <p>หากคุณไม่ได้ร้องขอการรีเซ็ตนี้ โปรดละเว้นอีเมลนี้</p>
        `
    };

    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            console.error('Error sending email:', error);
            return res.status(500).json({ message: 'เกิดข้อผิดพลาดในการส่งอีเมล. โปรดลองใหม่อีกครั้ง.' });
        } else {
            console.log('Email sent: ' + info.response);
            return res.status(200).json({ message: 'หากอีเมลนี้มีอยู่ในระบบ ลิงก์สำหรับรีเซ็ตรหัสผ่านได้ถูกส่งไปแล้วค่ะ' });
        }
    });
});

// Route สำหรับการตั้งรหัสผ่านใหม่
app.post('/api/reset-password', (req, res) => {
    const { token, newPassword } = req.body;
    console.log(`Received password reset request for token: ${token}`);
    console.log(`New password: ${newPassword}`);

    // *** ในส่วนนี้คือ Logic จริงๆ ที่ Backend ต้องทำ: ***
    // 1. **ตรวจสอบ Token:** ค้นหา Token นี้ในฐานข้อมูลของคุณ
    //    - ตรวจสอบว่า Token มีอยู่จริง
    //    - ตรวจสอบว่า Token ยังไม่หมดอายุ
    //    - ตรวจสอบว่า Token ตรงกับผู้ใช้ที่ถูกต้อง
    // 2. **ถ้า Token ถูกต้อง:**
    //    a. **เข้ารหัสรหัสผ่านใหม่ (Hash newPassword)** ด้วย bcrypt ก่อนเก็บ
    //    b. **อัปเดตรหัสผ่านของผู้ใช้** ในฐานข้อมูล
    //    c. **ลบ Token ออกจากฐานข้อมูล** หรือทำเครื่องหมายว่าใช้ไปแล้ว เพื่อป้องกันการใช้ซ้ำ
    // 3. ส่งสถานะการตอบกลับไป Frontend
    // **********************************************************************

    // *** สำหรับการทดสอบตอนนี้ เราจะสมมติว่า Token ถูกต้องเสมอ ***
    if (token && newPassword && newPassword.length >= 4) { // ตรวจสอบความยาวรหัสผ่านขั้นต่ำ
        console.log(`Password for user with token ${token} would be reset to ${newPassword}`);
        return res.status(200).json({ message: 'รีเซ็ตรหัสผ่านสำเร็จ (จำลอง)!' });
    } else {
        return res.status(400).json({ message: 'ข้อมูลไม่ถูกต้อง. โปรดตรวจสอบ Token และรหัสผ่านใหม่.' });
    }
});


// ************ เริ่ม Server ************
app.listen(port, () => {
  console.log(`Backend server listening at http://localhost:${port}`);
  console.log('You can now make requests to this server from your frontend.');
});
