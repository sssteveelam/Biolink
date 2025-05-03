// File này sẽ chứa các API liên quan đến đăng ký, đăng nhập.
const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt"); // Mình sẽ dùng bcrypt để hash password (Mongoose đã tự làm, nhưng để đây có thể cần sau này)
const User = require("../../models/User"); // Import User model, kiểm tra lại đường dẫn nếu cần
const crypto = require("crypto"); // Cần cho việc hash/compare token
const sendEmail = require("../../utils/email");

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
          avatarUrl: user.avatarUrl,
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

// @route   POST api/auth/forgot-password
// @desc    Gửi yêu cầu đặt lại mật khẩu
// @access  Public
router.post("/forgot-password", async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ message: "Vui lòng cung cấp email." });
  }

  try {
    const user = await User.findOne({ email: email.toLowerCase() });

    // !! Quan trọng: Không báo lỗi nếu không tìm thấy user vì lý do bảo mật
    // Chỉ gửi email nếu user tồn tại
    if (user) {
      // 1. Tạo token reset (phương thức này trả về token gốc, và hash + lưu vào user)
      const resetToken = user.createPasswordResetToken(); // Gọi phương thức đã tạo trong model
      await user.save({ validateBeforeSave: false }); // Lưu lại user với token và expiry (tắt validate tạm thời vì chỉ cập nhật token)

      // 2. Tạo URL reset mật khẩu cho frontend
      // Nhớ thay đổi URL gốc nếu deploy lên production
      const resetURL = `${
        process.env.FRONTEND_URL_DEPLOY || "http://localhost:5173"
      }/reset-password/${resetToken}`;

      // 3. Tạo nội dung email dạng HTML với INLINE STYLES (Mô phỏng Tailwind)
      const htmlMessage = `<!DOCTYPE html>
            <html lang="vi">
            <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>Đặt lại mật khẩu Biolink</title>
              <style>
                /* Chỉ dùng style rất cơ bản ở đây, chủ yếu là cho body */
                body { margin: 0; padding: 0; width: 100% !important; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
                table, td { border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt; } /* Cho Outlook */
                img { border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; -ms-interpolation-mode: bicubic; }
              </style>
            </head>
            <body style="margin: 0; padding: 0; background-color: #f3f4f6;"> <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f3f4f6;">
                <tr>
                  <td align="center" style="padding: 20px 10px;"> <table width="600" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 8px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); overflow: hidden;">
                      <tr>
                        <td style="padding: 40px 30px; font-family: Arial, sans-serif;"> <h2 style="color: #1f2937; font-size: 24px; margin-top: 0; margin-bottom: 16px; font-weight: 600;"> Yêu cầu Đặt lại Mật khẩu
                          </h2>
                          <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin-top: 0; margin-bottom: 24px;"> Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản Biolink liên kết với địa chỉ email này.
                          </p>
                          <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin-top: 0; margin-bottom: 24px;">
                            Vui lòng nhấn vào nút bên dưới để tạo mật khẩu mới:
                          </p>
                          <div style="text-align: center; margin-bottom: 32px;"> <a href="${resetURL}" target="_blank" style="background-color: #4f46e5; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block; font-size: 16px; border: 0; cursor: pointer;"> Đặt lại Mật khẩu
                            </a>
                          </div>
                          <p style="color: #4b5563; font-size: 14px; line-height: 1.5; margin-top: 0; margin-bottom: 12px;"> Nếu nút trên không hoạt động, bạn có thể sao chép và dán URL sau vào trình duyệt:
                          </p>
                          <p style="margin-bottom: 24px; font-size: 12px; word-break: break-all;"> <a href="${resetURL}" target="_blank" style="color: #4f46e5; text-decoration: underline;">${resetURL}</a> </p>
                          <p style="color: #4b5563; font-size: 14px; line-height: 1.5; margin-top: 0; margin-bottom: 10px;">
                            <i>Liên kết này chỉ có hiệu lực trong <strong>10 phút</strong>.</i>
                          </p>
                          <p style="color: #4b5563; font-size: 14px; line-height: 1.5; margin-top: 0; margin-bottom: 0;">
                            Nếu bạn không thực hiện yêu cầu này, bạn có thể yên tâm bỏ qua email này.
                          </p>
                        </td>
                      </tr>

                      <tr>
                        <td style="padding: 20px 30px; text-align: center; border-top: 1px solid #e5e7eb;"> <p style="color: #6b7280; font-size: 12px; margin: 0;"> &copy; ${new Date().getFullYear()} ${
        process.env.EMAIL_FROM_NAME || "Biolink App"
      }. Bảo lưu mọi quyền.
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </body>
            </html>
      `;

      // 3.1 (Quan trọng) Tạo phiên bản Text đơn giản làm fallback
      const textMessage = `
         Bạn nhận được email này vì bạn (hoặc ai đó) đã yêu cầu đặt lại mật khẩu cho tài khoản Biolink của bạn.
         Vui lòng truy cập đường link sau để hoàn tất quá trình (link hết hạn sau 10 phút):
         \n\n
         ${resetURL}
         \n\n
         Nếu bạn không yêu cầu việc này, vui lòng bỏ qua email này.
         \n
         Trân trọng, Đội ngũ Biolink.
       `;

      try {
        // 4. Gửi email (dùng hàm sendEmail sẽ tạo ở bước sau)
        await sendEmail({
          email: user.email,
          subject: "Yêu cầu đặt lại mật khẩu Biolink (Hiệu lực 10 phút)",
          text: textMessage, // <-- Truyền nội dung text
          html: htmlMessage, // <-- Truyền nội dung HTML
        });
        console.log(`Password reset email sent to ${user.email}`);
      } catch (emailError) {
        console.error("Error sending password reset email:", emailError);
        // Nếu gửi email lỗi, cần xóa token đã tạo khỏi DB để user có thể thử lại
        user.passwordResetToken = undefined;
        user.passwordResetExpires = undefined;
        await user.save({ validateBeforeSave: false });
        // Không nên báo lỗi chi tiết cho người dùng ở đây
        // return res.status(500).json({ message: 'Không thể gửi email đặt lại mật khẩu. Vui lòng thử lại.' });
      }
    }
    // Luôn trả về thông báo thành công chung chung để tránh lộ thông tin email nào tồn tại/không tồn tại
    res.status(200).json({
      message: "Nếu email tồn tại, hướng dẫn đặt lại mật khẩu đã được gửi.",
    });
  } catch (error) {
    console.error("Forgot Password Server Error:", error);
    // Nếu có lỗi khác xảy ra trong quá trình tìm user hoặc save token
    // Không nên báo lỗi chi tiết cho người dùng
    res.status(200).json({
      message: "Nếu email tồn tại, hướng dẫn đặt lại mật khẩu đã được gửi.",
    }); // Vẫn trả về thông báo chung
  }
});

// @route   POST api/auth/reset-password/:token
// @desc    Đặt lại mật khẩu bằng token
// @access  Public
router.post("/reset-password/:token", async (req, res) => {
  const { password } = req.body;
  const resetToken = req.params.token;

  if (!password || password.length < 6) {
    return res
      .status(400)
      .json({ message: "Mật khẩu mới phải có ít nhất 6 ký tự." });
  }

  try {
    // 1. Hash token nhận được từ URL để so sánh với token trong DB
    const hashedToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    // 2. Tìm user bằng hashed token VÀ token chưa hết hạn (expires > Date.now())
    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() }, // Kiểm tra thời gian hết hạn
    });

    // 3. Nếu không tìm thấy user hoặc token hết hạn
    if (!user) {
      return res
        .status(400)
        .json({ message: "Token không hợp lệ hoặc đã hết hạn." });
    }

    // 4. Nếu tìm thấy user và token hợp lệ:
    //   a. Cập nhật mật khẩu mới (pre-save hook sẽ tự hash)
    user.password = password;
    //   b. Xóa thông tin token reset khỏi DB
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    //   c. Lưu lại user
    await user.save(); // Gọi save() để trigger pre-save hook hash password

    // 5. (Tùy chọn) Có thể tạo một JWT mới và gửi về để user tự động đăng nhập luôn
    //    hoặc chỉ cần báo thành công và yêu cầu user đăng nhập lại.
    //    Ở đây mình chỉ báo thành công:
    res.status(200).json({ message: "Đặt lại mật khẩu thành công!" });
  } catch (error) {
    console.error("Reset Password Server Error:", error);
    if (error.name === "ValidationError") {
      // Nếu lỗi validate mật khẩu mới
      return res
        .status(400)
        .json({ message: "Validation Error", errors: error.errors });
    }
    res.status(500).json({ message: "Lỗi server khi đặt lại mật khẩu." });
  }
});

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
