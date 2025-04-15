require("dotenv").config();

const express = require("express");
const cors = require("cors");
// const mongoose = require("mongoose"); // su dung sau

const app = express();
const PORT = process.env.PORT || 3001; // Dùng cổng từ file .env hoặc mặc định 3001

// --- Middleware ---
// CORS: Cho phép frontend (chạy ở localhost:5173) gọi được API
// Quan trọng: Nhớ thay đổi origin khi deploy lên production
app.use(cors({ origin: process.env.FRONTEND_URL || "http://localhost:5173" }));

// Parse JSON request bodies (để đọc được req.body khi client gửi JSON)
app.use(express.json());

// Parse URL-encoded request bodies (ít dùng hơn với API JSON, nhưng cứ thêm vào)
app.use(express.urlencoded({ extended: true }));

// --- Database Connection ---
// TODO: Thêm code kết nối MongoDB ở đây (sẽ làm ở phase sau)
/*
mongoose.connect(process.env.DATABASE_URL, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('Could not connect to MongoDB...', err));
*/

// --- Routes ---
// Route test đơn giản để kiểm tra server có chạy không
app.get("/api/ping", (req, res) => {
  console.log("Received ping request"); // Thêm log để kiểm tra
  res.status(200).json({ message: "pong from backend!" });
});

// TODO: Thêm các API routes chính thức (auth, users, links...)

// --- Start Server ---
app.listen(PORT, () => {
  console.log(`Backend server is listening on http://localhost:${PORT}`);
});
