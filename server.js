// นำเข้า Library ที่จำเป็น
const express = require('express'); // Framework สำหรับสร้าง Web Server
const cors = require('cors'); // Middleware สำหรับจัดการ Cross-Origin Resource Sharing (CORS)
const bodyParser = require('body-parser'); // Middleware สำหรับ Parse Request Body (เช่น JSON)
// ไม่จำเป็นต้องใช้ firebase-admin, bcrypt, nodemailer อีกต่อไป

const app = express(); // สร้าง Instance ของ Express Application
const port = process.env.PORT || 3000; // กำหนด Port ที่ Backend Server จะทำงาน (ใช้จาก Environment Variable ของ Render ถ้ามี หรือ 3000)

// Middleware:
// อนุญาตให้ Frontend สามารถส่ง Request มายัง Backend ได้ (สำคัญมากสำหรับ CORS)
app.use(cors());
// ใช้ body-parser สำหรับแปลง Request Body ที่เป็น JSON
app.use(bodyParser.json());

// ไม่มีการเชื่อมต่อ Firebase Admin SDK อีกต่อไป
// ไม่มีการกำหนดค่า Nodemailer transporter อีกต่อไป

// ************ Routes (เส้นทาง API) ************

// Route สำหรับ Home Page (เมื่อเข้าถึง URL หลักของ Backend Server)
app.get('/', (req, res) => {
  res.send('Hello from Backend Server! This is a simple backend for a static site.');
});

// Routes ที่เกี่ยวข้องกับ Admin, Register, Login, Forgot/Reset Password ถูกลบออกไปทั้งหมด

// ************ เริ่ม Server ************
app.listen(port, () => {
  console.log(`Backend server listening at http://localhost:${port}`);
  console.log('You can now make requests to this server from your frontend.');
});
