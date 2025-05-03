const mongoose = require("mongoose");

const profileSchema = new mongoose.Schema(
  {
    // Liên kết với User (Quan hệ 1-1)
    // Mỗi profile sẽ thuộc về duy nhất 1 user
    userId: {
      type: mongoose.Schema.Types.ObjectId, // Kiểu dữ liệu đặc biệt của MongoDB để lưu ID
      ref: "User", // Tham chiếu đến model 'User'
      required: true, // Bắt buộc phải có userId
      unique: true, // Đảm bảo mỗi user chỉ có 1 profile
    },
    bio: {
      // Tiểu sử ngắn (không bắt buộc)
      type: String,
      trim: true,
      maxlength: [160, "Bio cannot be more than 160 characters"], // Giới hạn độ dài Bio
    },
    themeColor: {
      // Mã màu cho theme (không bắt buộc, có thể có giá trị mặc định)
      type: String,
      trim: true,
      default: "#ffffff", // Ví dụ: màu trắng làm mặc định
    },
    buttonStyle: {
      type: String,
      enum: ["rounded-full", "rounded-lg", "rounded-none"],
      default: "rounded-lg",
      trim: true,
    },
    selectedThemeId: {
      type: String, // Lưu ID của theme (vd: 'gradient-sunset', 'image-forest', 'custom-color')
      trim: true,
      default: null, // Mặc định là chưa chọn theme nào (sẽ dùng themeColor)
    },
  },
  // Tự động thêm createdAt và updatedAt
  { timestamps: true }
);

const Profile = mongoose.model("Profile", profileSchema);

module.exports = Profile;
