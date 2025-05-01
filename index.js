// File: index.js (mới tạo)
const app = require("./server"); // Import app từ server.js
const PORT = process.env.PORT || 3001;

// Chỉ khởi động server nếu file này được chạy trực tiếp
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Backend server is listening on http://localhost:${PORT}`);
  });
}
