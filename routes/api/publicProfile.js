const express = require("express");
const router = express.Router();
const User = require("../../models/User");
const Profile = require("../../models/Profile");
const Link = require("../../models/Link");

// @route   GET api/profiles/:username
// @desc    Get public profile data (user info, profile, links) by username
// @access  Public
router.get("/:username", async (req, res) => {
  try {
    const usernameParam = req.params.username.toLowerCase(); // Lấy username từ URL và chuyển thành chữ thường
    console.log(
      `[PublicProfile] Received request for username: ${usernameParam}`
    ); // Thêm log

    // 1. Tìm user dựa vào username
    // Chỉ lấy những trường cần thiết cho trang public, loại bỏ email, password...
    const user = await User.findOne({ username: usernameParam }).select(
      "username name image createdAt"
    ); // Chỉ lấy các trường này;

    console.log(`[PublicProfile] Found user:`, user ? user._id : "Not Found"); // Thêm log

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // 2. Tìm profile của user đó
    const profile = await Profile.findOne({
      userId: user._id,
    }).select("bio themeColor"); // Chỉ lấy bio và themeColor

    console.log(
      `[PublicProfile] Found profile:`,
      profile ? profile._id : "Not Found"
    ); // Thêm log

    // 3. Tìm tất cả link của user đó, sắp xếp theo order
    const links = await Link.find({ userId: user._id })
      .sort({ order: "asc" })
      .select("title url _id"); // Chỉ lấy title, url, và _id (có thể cần làm key)
    console.log(`[PublicProfile] Found links count:`, links.length); // Thêm log

    // 4. Kết hợp dữ liệu lại và trả về
    res.status(200).json({
      user, // Thông tin user cơ bản
      profile, // Thông tin profile (có thể là null nếu chưa tạo)
      links, // Danh sách links (có thể là mảng rỗng)
    });
  } catch (error) {
    console.error("[PublicProfile] Error fetching public profile:", error);
    res
      .status(500)
      .json({ message: "Server error fetching public profile data" });
  }
});

module.exports = router;
