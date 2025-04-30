const express = require("express");
const router = express.Router();
const authMiddleware = require("../../middleware/authMiddleware");

const Profile = require("../../models/Profile");
const User = require("../../models/User");

// @route   GET api/user/profile/me
// @desc    Get current user's profile
// @access  Private
// Dùng /me để lấy profile của chính user đang đăng nhập (dựa vào token)
router.get("/me", authMiddleware, async (req, res) => {
  try {
    // Tìm profile dựa vào userId lấy từ token (được gắn vào req.user bởi authMiddleware)
    // Dùng populate để lấy kèm thông tin từ User model (ví dụ: username, email) nếu cần
    const profile = await Profile.findOne({ userId: req.user.userId });

    // Nếu user đã đăng ký nhưng chưa từng cập nhật profile -> profile có thể chưa tồn tại
    if (!profile) {
      return res.status(404).json({
        message: "Profile not found for this ",
      });

      // Hoặc: return res.status(200).json(null);
    }

    res.status(200).json(profile); // Trả về profile tìm được
  } catch (error) {
    console.error("Error fetching profile:", error);
    res.status(500).json({ message: "Server error fetching profile" });
  }
});

// @route   PUT api/user/profile/me
// @desc    Create or update current user's profile
// @access  Private
router.put("/me", authMiddleware, async (req, res) => {
  // Lấy thông tin cần cạp nhật từ request body
  const { bio, themeColor, buttonStyle } = req.body;

  // Tạo object chứa các field cần cập nhật.
  const profileFields = {};

  if (bio != undefined) profileFields.bio = bio;
  if (themeColor !== undefined) profileFields.themeColor = themeColor;

  // --- THÊM LOGIC CHO buttonStyle ---
  // Kiểm tra xem buttonStyle có được gửi lên và có phải là một trong các giá trị cho phép không
  const allowedButtonStyles = ["rounded-full", "rounded-lg", "rounded-none"];
  if (buttonStyle !== undefined && allowedButtonStyles.includes(buttonStyle)) {
    profileFields.buttonStyle = buttonStyle;
  } else if (buttonStyle !== undefined) {
    // (Tùy chọn) Nếu gửi lên giá trị không hợp lệ, có thể báo lỗi hoặc bỏ qua
    console.warn(`Invalid buttonStyle received: ${buttonStyle}. Ignoring.`);
    // Hoặc return res.status(400).json({ message: 'Kiểu nút không hợp lệ.' });
  }

  try {
    //  Tìm và cập nhật profile của user đang đăng nhập
    //  Dùng findOneAndUpdate với tùy chọn upsert: true
    // - Nếu tìm thấy profile -> cập nhật nó
    // - Nếu không tìm thấy -> tạo mới profile cho user này (upsert = update + insert)

    let profile = await Profile.findOneAndUpdate(
      { userId: req.user.userId }, // Điều kiện tìm kiếm: profile của user này
      { $set: profileFields }, // Dữ liệu cần cập nhật/thêm mới
      {
        new: true,
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      }
      // new: true -> trả về document sau khi đã update
      // upsert: true -> tạo mới nếu không tìm thấy
      // runValidators: true -> chạy các validation đã định nghĩa trong Schema
      // setDefaultsOnInsert: true -> áp dụng giá trị default (vd: themeColor) nếu là tạo mới
    );

    res.status(200).json(profile); // Trả về profile đã được cập nhật hoặc tạo mới
  } catch (error) {
    console.error("Error updating profile:", error);
    if (error.name === "ValidationError") {
      return res
        .status(400)
        .json({ message: "Validation Error", errors: error.errors });
    }
    res.status(500).json({ message: "Server error updating profile" });
  }
});

module.exports = router;
