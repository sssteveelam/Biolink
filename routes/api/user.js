const express = require("express");
const router = express.Router();
const multer = require("multer");
const cloudinary = require("cloudinary").v2; // Dùng v2 nhé
const authMiddleware = require("../../middleware/authMiddleware"); // [cite: 1]
const User = require("../../models/User"); //
require("dotenv").config(); // Load biến môi trường

// --- Cấu hình Cloudinary ---
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// --- Cấu hình Multer ---
// Lưu file tạm vào bộ nhớ thay vì disk (đơn giản hơn cho Render/Heroku)
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // Giới hạn 5MB
  fileFilter: (req, file, cb) => {
    // Chỉ chấp nhận file ảnh
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Chỉ chấp nhận file ảnh!"), false);
    }
  },
});

// --- API Endpoint: PUT /api/user/avatar ---
// Dùng PUT vì mình đang cập nhật thông tin user
router.put(
  "/avatar",
  authMiddleware, // Bảo vệ route, chỉ user đăng nhập mới được upload
  upload.single("avatar"), // Middleware của multer, 'avatar' là tên field trong FormData gửi từ frontend
  async (req, res) => {
    try {
      if (!req.file) {
        return res
          .status(400)
          .json({ message: "Không có file nào được tải lên." });
      }

      // Upload file từ buffer lên Cloudinary
      // Mình cần stream file từ buffer, dùng upload_stream
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: "biolink_avatars", // Thư mục trên Cloudinary (tùy chọn)
          // Có thể thêm các tùy chọn khác như crop, resize,... ở đây
        },
        async (error, result) => {
          if (error) {
            console.error("Cloudinary Upload Error:", error);
            return res
              .status(500)
              .json({ message: "Lỗi khi upload ảnh lên Cloudinary." });
          }

          // Upload thành công, result chứa thông tin ảnh, quan trọng là result.secure_url
          const avatarUrl = result.secure_url;

          // Cập nhật user trong database
          const updatedUser = await User.findByIdAndUpdate(
            req.user.userId, // Lấy userId từ authMiddleware
            { $set: { avatarUrl: avatarUrl } }, // Hoặc dùng 'image: avatarUrl' nếu bạn dùng trường 'image'
            { new: true, select: "-password" } // Trả về user mới nhất, bỏ password
          );

          if (!updatedUser) {
            return res
              .status(404)
              .json({ message: "Không tìm thấy người dùng." });
          }

          res.status(200).json({
            message: "Cập nhật avatar thành công!",
            user: updatedUser, // Trả về thông tin user đã cập nhật
          });
        }
      );

      // Gửi buffer của file cho Cloudinary stream
      uploadStream.end(req.file.buffer);
    } catch (err) {
      console.error("Avatar Upload Server Error:", err);
      // Xử lý lỗi validation của multer (vd: file quá lớn, sai loại file)
      if (err instanceof multer.MulterError) {
        return res
          .status(400)
          .json({ message: `Multer Error: ${err.message}` });
      }
      if (err.message === "Chỉ chấp nhận file ảnh!") {
        return res.status(400).json({ message: err.message });
      }
      res.status(500).json({ message: "Lỗi server khi xử lý upload avatar." });
    }
  }
);

module.exports = router;
