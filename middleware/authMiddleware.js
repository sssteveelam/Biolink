const jwt = require("jsonwebtoken");
const User = require("../models/User");

const authMiddleware = async (req, res, next) => {
  let token;
  // 1. Kiểm tra xem header 'Authorization' có tồn tại và bắt đầu bằng 'Bearer' không

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    try {
      // 2. Lấy token từ header (Bỏ chữ 'Bearer ' đi)
      token = req.headers.authorization.split(" ")[1];

      // 3. Xác thực token bằng secret key
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // 4. Token hợp lệ, lấy userId từ payload đã decode
      // Gắn thông tin user (chỉ lấy id hoặc các thông tin cần thiết khác, trừ password) vào request
      // để các route handler sau có thể sử dụng
      // req.user = await User.findById(decoded.userId).select('-password'); // Lấy cả user data từ DB

      req.user = { userId: decoded.userId }; // Hoặc chỉ cần userId là đủ cho bước này

      if (!req.user) {
        // Trường hợp edge case: user bị xóa sau khi token được cấp
        // throw new Error('User not found'); // Hoặc return lỗi trực tiếp
        return res
          .status(401)
          .json({ message: "Not authorized, user not found" });
      }

      next(); // Cho phép request đi tiếp đến route handler
    } catch (error) {
      console.error("Token verification failed:", error.message);

      if (error.name === "JsonWebTokenError") {
        return res
          .status(401)
          .json({ message: "Not authorized, token failed" });
      }
      if (error.name === "TokenExpiredError") {
        return res
          .status(401)
          .json({ message: "Not authorized, token expired" });
      }
      res.status(401).json({ message: "Not authorized, token error" });
    }
  }

  if (!token) {
    res.status(401).json({ message: "Not authorized, no token" });
  }
};

module.exports = authMiddleware;
