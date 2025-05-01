require("dotenv").config();

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose"); // su dung sau
const rateLimit = require("express-rate-limit");

const app = express();
const PORT = process.env.PORT || 3001; // Dùng cổng từ file .env hoặc mặc định 3001
const authRoutes = require("./routes/api/auth");
const profileRoutes = require("./routes/api/profile");
const linkRoutes = require("./routes/api/links");
const publicProfileRoutes = require("./routes/api/publicProfile");
const userRoutes = require("./routes/api/user");
//------------------------------------------------------------------------------------
// rateLimit
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 phút
  max: 100, // Giới hạn mỗi IP 100 requests mỗi 15 phút
  message: "Quá nhiều yêu cầu từ IP này, vui lòng thử lại sau 15 phút",
});
//------------------------------------------------------------------------------------
// --- Middleware ---
// CORS: Cho phép frontend (chạy ở localhost:5173) gọi được API
// Quan trọng: Nhớ thay đổi origin khi deploy lên production
app.use(cors({ origin: process.env.FRONTEND_URL || "http://localhost:5173" }));
//------------------------------------------------------------------------------------

// Parse JSON request bodies (để đọc được req.body khi client gửi JSON)
app.use(express.json());
//------------------------------------------------------------------------------------

// Parse URL-encoded request bodies (ít dùng hơn với API JSON, nhưng cứ thêm vào)
app.use(express.urlencoded({ extended: true }));
//------------------------------------------------------------------------------------

// --- Database Connection ---
// TODO: Thêm code kết nối MongoDB ở đây (sẽ làm ở phase sau)
// Kiểm tra xem DATABASE_URL đã được đặt trong .env chưa
if (!process.env.DATABASE_URL) {
  console.error("FATAL ERROR: DATABASE_URL is not defined in .env file");
  process.exit(1); // Thoát ứng dụng nếu không có connection string
}
//------------------------------------------------------------------------------------

mongoose
  .connect(process.env.DATABASE_URL)
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => {
    console.error("Could not connect to MongoDB...", err);
    process.exit(1);
  });

//------------------------------------------------------------------------------------
// --- Routes ---
// Route test đơn giản để kiểm tra server có chạy không
app.get("/api/ping", (req, res) => {
  console.log("Received ping request"); // Thêm log để kiểm tra
  res.status(200).json({ message: "pong from backend!" });
});

// TODO: Thêm các API routes chính thức (auth)
/// --- /api/auth ---
// Việc đặt app.use('/api/auth', authRoutes) có nghĩa là route /register trong
// file auth.js sẽ tương ứng với đường dẫn đầy đủ là POST /api/auth/register
app.use("/api/auth", authLimiter, authRoutes);

//  @@@@
/// --- /api/user/profile ---
//  sử dụng các routes trong file profile.js cho đường dẫn bắt đầu bằng /api/user/profile
app.use("/api/user/profile", profileRoutes);
/// --- /api/user/links ---
app.use("/api/user/links", linkRoutes); // <-- Thêm dòng này
// Public API Routes
app.use("/api/profiles", publicProfileRoutes);
//------------------------------------------------------------------------------------
// User API Routes
app.use("/api/user", userRoutes);

// --- Start Server ---
// app.listen(PORT, () => {
//   console.log(`Backend server is listening on http://localhost:${PORT}`);
// });
module.exports = app;
