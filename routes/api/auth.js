// File này sẽ chứa các API liên quan đến đăng ký, đăng nhập.
const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt"); // Mình sẽ dùng bcrypt để hash password (Mongoose đã tự làm, nhưng để đây có thể cần sau này)
const User = require("../../models/User"); // Import User model, kiểm tra lại đường dẫn nếu cần
// -----------------------------------------------------------

// login
const jwt = require("jsonwebtoken");

// -----------------------------------------------------------
// Middleware
const authMiddleware = require("../../middleware/authMiddleware");

// -----------------------------------------------------------
// Register

// @route   POST api/auth/register
// @desc    Register new user
// @access  Public
router.post("/register", async (req, res) => {
  // 1. Lấy dữ liệu từ request body gửi lên từ client (front end)
  const { username, email, password, name } = req.body;

  // 2. Validate dữ liệu cơ bản (bạn có thể thêm thư viện validation như express-validator sau nay)
  if (!username || !email || !password) {
    return res
      .status(400)
      .json({ message: "Please provide username, email and password !" });
  }

  try {
    // 3. Kiểm tra xem username hoặc email đã tồn tại trong DB chưa?
    let existingUser = await User.findOne({
      $or: [
        { email: email.toLowerCase() },
        { username: username.toLowerCase() },
      ],

      //$or: [ ... ]: Đây chính là toán tử bạn hỏi. Nó có nghĩa là "HOẶC". Điều kiện bên trong {...} sẽ đúng nếu ít nhất một trong các điều kiện con nằm trong cái mảng [...] là đúng.
    });

    // "Hãy tìm xem có user nào trong database mà HOẶC LÀ có email trùng với email đang định đăng ký, HOẶC LÀ có username trùng với username đang định đăng ký hay không."

    if (existingUser) {
      return res.status(400).json({
        message: "Username or email already exist!",
      });
    }

    // 4. Nếu chưa tồn tại, tạo một User mới từ Model
    const newUser = new User({
      username: username.toLowerCase(), // Lưu username chữ thường
      email: email.toLowerCase(), // Lưu email chữ thường
      password: password, // Chỉ cần truyền password gốc, pre-save hook trong model sẽ tự hash
      name: name, // Tên hiển thị (nếu có)
    });

    // 5. Lưu user mới vào database
    const savedUser = await newUser.save(); // pre-save hook sẽ chạy ở đây để hash password

    // 6. Trả về thông tin user đã tạo (loại bỏ password)
    // Lưu ý: .toJSON() hoặc .toObject() có thể cần thiết để xóa field
    const userResponse = savedUser.toObject();
    delete userResponse.password; // Không bao giờ trả password về client

    res
      .status(201)
      .json({ message: "User registered successfully!", user: userResponse });
  } catch (error) {
    console.error("Error registering user:", error);
    // Xử lý các lỗi khác (ví dụ: lỗi validation từ Mongoose, lỗi kết nối DB...)
    if (error.name === "ValidationError") {
      return res
        .status(400)
        .json({ message: "Validation Error", errors: error.errors });
    }
    res.status(500).json({ message: "Server error during registration" });
  }
});
// -----------------------------------------------------------
// Login

// @route   POST api/auth/login
// @desc    Authenticate user & get token (Login)
// @access  Public
router.post("/login", async (req, res) => {
  // 1. lấy email (hoặc username) và password từ request body
  const { email, password } = req.body;

  // 2. Validate cơ bản
  if (!email || !password) {
    return res
      .status(400)
      .json({ message: "Please provide email and password" });
  }

  try {
    // 3. Tìm user trong DB bằng email
    const user = await User.findOne({ email: email.toLowerCase() });

    // 4. Nếu không tìm thấy user -> báo lỗi.
    if (!user) {
      return res.status(400).json({ message: "Invalid Credentials" });
    }

    // 5. Nếu tìm thấy user, so sánh mật khẩu nhập vào với mật khẩu đã hash trong DB
    // Dùng phương thức comparePassword mình đã thêm vào User model
    //
    const isMatch = await user.comparePassword(password);

    // 6. nếu mật khẩu khớp -> báo lỗi.
    if (!isMatch) {
      return res.status(400).json({
        message: "Invalid Credentials",
      });
    }

    // 7. Nếu mật khẩu khớp -> Tạo JWT Token
    //   a. Chuẩn bị payload (thông tin muốn chứa trong token)
    const payload = {
      userId: user.id,
      username: user.username,
      // *** TUYỆT ĐỐI KHÔNG ĐƯA MẬT KHẨU VÀO PAYLOAD ***
    };
    //   b. Lấy secret key từ biến môi trường
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      console.error("FATAL ERROR: JWT_SECRET is not defined in .env file");
      return res.status(500).json({ message: "Server configuration error" });
    }
    //   c. Ký và tạo token
    jwt.sign(payload, jwtSecret, { expiresIn: "1h" }, (err, token) => {
      if (err) throw err; // Ném lỗi nếu không ký được token
      // 8. Gửi token về cho client
      res.status(200).json({
        message: "Login successful",
        token: token,
        user: {
          // Có thể gửi kèm một ít thông tin user nếu frontend cần
          id: user.id,
          username: user.username,
          email: user.email,
          name: user.name,
        },
      });
    });
  } catch (error) {
    console.error("Error during login:", error);
    res.status(500).json({ message: "Server error during login" });
  }
});
// -----------------------------------------------------------
// Middleware
// @route   GET api/auth/me
// @desc    Get current logged in user data (using token)
// @access  Private (requires token
router.get("/me", authMiddleware, async (req, res) => {
  // Nếu request đến được đây, nghĩa là authMiddleware đã chạy thành công
  // và đã gắn thông tin user (ít nhất là userId) vào req.user
  try {
    // Lấy thông tin user đầy đủ từ DB dựa vào ID lấy từ token (đã được middleware gắn vào req.user)
    // Dùng .select('-password') để loại bỏ trường password khỏi kết quả trả về
    const user = await User.findById(req.user.userId).select("-password");

    if (!user) {
      // Dù middleware đã pass nhưng user có thể đã bị xóa trong DB
      return res.status(404).json({ message: "User not found" });
    }

    // Trả về thông tin user (không có password)
    res.status(200).json(user);
  } catch (error) {
    console.error("Error fetching user data for /me:", error);
    res.status(500).json({ message: "Server error fetching user data" });
  }
});
// -----------------------------------------------------------
/*
hỏi về payload có ý nghĩa như thế nào ?

JWT là gì?

Trước tiên, bạn cần biết sơ qua về JWT (JSON Web Token). Nó giống như một cái "chứng minh thư" hoặc "vé thông hành" kỹ thuật số mà server (backend) cấp cho client (frontend) sau khi người dùng đăng nhập thành công. Frontend sẽ gửi kèm cái vé này trong các request tiếp theo để chứng minh "tôi là người dùng A đã đăng nhập".

Cấu trúc JWT:

Một chuỗi JWT thường có 3 phần, ngăn cách bởi dấu chấm (.): xxxxx.yyyyy.zzzzz

Header: Chứa thông tin về thuật toán mã hóa được dùng.
Payload: Đây chính là phần mà biến payload trong code của mình tạo ra! Nó chứa các thông tin (gọi là "claims") về người dùng hoặc về phiên đăng nhập đó.
Signature: Chữ ký điện tử, được tạo ra từ Header, Payload và một secret key (chìa khóa bí mật) chỉ có server biết. Chữ ký này đảm bảo rằng thông tin trong Header và Payload không bị sửa đổi trên đường truyền và token này đúng là do server cấp phát.
Ý nghĩa của biến payload trong code:



const payload = {
    userId: user.id, // ID của user
    username: user.username // Có thể thêm username hoặc role nếu cần
    // *** TUYỆT ĐỐI KHÔNG ĐƯA MẬT KHẨU VÀO PAYLOAD ***
};
Biến payload này là một đối tượng JavaScript chứa những thông tin cốt lõi mà mình muốn "nhúng" vào bên trong phần Payload của JWT.

Tại sao mình cần nhúng thông tin này?

Khi frontend nhận được JWT từ backend sau khi login thành công, nó có thể giải mã phần Payload (phần này thường chỉ được mã hóa Base64, không phải mã hóa bảo mật) để đọc được ngay lập tức các thông tin cơ bản như userId, username mà không cần phải gọi lại API lên backend chỉ để hỏi "người dùng vừa đăng nhập là ai?".
Frontend có thể dùng thông tin này để:
Hiển thị lời chào (ví dụ: "Chào mừng, huytest!").
Lưu lại userId để sử dụng cho các request API khác (ví dụ: khi lấy danh sách link của user này).
Quyết định hiển thị/ẩn một số thành phần giao diện dựa trên thông tin user (nếu có thêm role chẳng hạn).
Quá trình jwt.sign():

Hàm jwt.sign(payload, jwtSecret, { expiresIn: '1h' }, callback) sẽ lấy cái payload (dữ liệu bạn muốn nhúng), lấy jwtSecret (chìa khóa bí mật) và các tùy chọn khác (như thời gian hết hạn expiresIn), rồi tạo ra chữ ký (Signature).
Cuối cùng, nó kết hợp Header, Payload (đã mã hóa Base64), và Signature thành một chuỗi JWT hoàn chỉnh và trả về qua token trong callback.
Điểm quan trọng cần nhớ: Vì phần Payload có thể bị giải mã dễ dàng, tuyệt đối không bao giờ đưa thông tin nhạy cảm như mật khẩu vào trong payload. Chỉ nên đưa vào những thông tin định danh cơ bản và không quá nhạy cảm. Sự bảo mật của JWT nằm ở chỗ chữ ký (Signature) đảm bảo tính toàn vẹn và xác thực nguồn gốc, chứ không phải ở việc che giấu nội dung Payload.

Bạn đã hình dung rõ hơn về vai trò của payload chưa? Nó chính là "trái tim" chứa dữ liệu của cái vé thông hành JWT đó! 😊

*/

module.exports = router; // Export router để server.js có thể dùng
