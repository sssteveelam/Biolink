const mongoose = require("mongoose");

const linkSchema = new mongoose.Schema(
  {
    // Liên kết với User (Quan hệ 1-nhiều)
    // Mỗi link sẽ thuộc về 1 user, nhưng 1 user có thể có nhiều link
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true, // Bắt buộc phải có userId
      // Không có unique: true ở đây vì 1 user có thể có nhiều link
    },
    title: {
      // Tiêu đề hiển thị cho link
      type: String,
      required: [true, "Link title is required"],
      trim: true,
      maxlength: [100, "Link title cannot be more than 100 characters"],
    },
    url: {
      // Đường dẫn URL của link
      type: String,
      required: [true, "Link URL is required"],
      trim: true,
      // Bạn có thể thêm validation phức tạp hơn cho URL nếu muốn
    },
    order: {
      // Số thứ tự để sắp xếp link
      type: Number,
      required: true,
      default: 0, // Mặc định là 0
    },
    // Tự động thêm createdAt và updatedAt
  },
  { timestamps: true }
);

// Thêm index cho userId để tăng tốc độ truy vấn các link của một user
linkSchema.index({ userId: 1 });
// "Hãy tạo một danh sách đặc biệt (gọi là index), sắp xếp theo trường userId. Trong danh sách này, ghi lại xem mỗi giá trị userId khác nhau thì tương ứng với những 'dòng dữ liệu' (document) nào trong bảng links."
const Link = mongoose.model("Link", linkSchema);

module.exports = Link;
