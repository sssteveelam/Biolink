const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, "Username is required"],
      unique: true, // khong duoc trung lap
      trim: true,
      lowercase: true,
      match: [
        /^[a-zA-Z0-9_]+$/,
        "Username can only contain letters, numbers, and underscores",
      ], // Chỉ cho phép ký tự an toàn cho URL
      minlength: [3, "Username must be at least 3 characters long"], // Độ dài tối thiểu
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      trim: true,
      lowercase: true,
      match: [/\S+@\S+\.\S+/, "Please use a valid email address"], // Kiểm tra định dạng email cơ bản
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [6, "Password must be at least 6 characters long"], // Mật khẩu tối thiểu 6 ký tự
    },
    name: {
      // Tên hiển thị (không bắt buộc)
      type: String,
      trim: true,
    },
    avatarUrl: {
      // Hoặc dùng tên 'image' nếu bạn muốn tận dụng trường cũ
      type: String,
      trim: true,
      default: null, // Mặc định là null hoặc chuỗi rỗng
    },
    passwordResetToken: {
      type: String,
      default: null, // Mặc định không có token
    },
    passwordResetExpires: {
      type: Date,
      default: null, // Mặc định không có thời gian hết hạn
    },
  },
  // Tự động thêm createdAt và updatedAt
  { timestamps: true }
);

// Middleware: Tự động mã hóa mật khẩu TRƯỚC KHI lưu vào DB
userSchema.pre("save", async function (next) {
  // chỉ hash mật khẩu nếu nó được thay đổi (hoặc là user mới)
  if (!this.isModified("password")) return next();

  try {
    // tạo "muối" để tăng cường bảo mật mã hóa
    const salt = await bcrypt.genSalt(10);

    // Hash mật khẩu với muối
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error); // Chuyển lỗi cho Mongoose xử lý
  }
});

// Thêm một phương thức để tạo token reset dễ dàng
userSchema.methods.createPasswordResetToken = function () {
  const resetToken = require("crypto").randomBytes(32).toString("hex"); // Tạo token ngẫu nhiên

  // Hash token trước khi lưu vào DB (quan trọng!)
  this.passwordResetToken = require("crypto")
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");

  // Đặt thời gian hết hạn (ví dụ: 10 phút)
  this.passwordResetExpires = Date.now() + 10 * 60 * 1000; // 10 minutes

  console.log({
    resetToken_raw: resetToken,
    resetToken_hashed: this.passwordResetToken,
  }); // Log để debug

  return resetToken;
};

/*
Lý do: next là một hàm callback mà Mongoose cung cấp trong middleware. 
Mình cần gọi next() để báo cho Mongoose biết là xử lý của mình đã xong 
và có thể chuyển sang bước tiếp theo (là bước lưu dữ liệu vào DB hoặc middleware khác). 
Nếu không gọi next(), quá trình lưu sẽ bị "treo" đó.
*/

// (Tùy chọn) Thêm một phương thức để kiểm tra mật khẩu khi đăng nhập
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model("User", userSchema);

module.exports = User;
