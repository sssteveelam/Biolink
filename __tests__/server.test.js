// File: __tests__/server.test.js
const request = require("supertest");
const app = require("../server"); // Import app từ file server.js đã chỉnh sửa
const mongoose = require("mongoose"); // <-- Thêm dòng này

describe("API Server", () => {
  // Test cho endpoint GET /api/ping
  it("GET /api/ping - nên trả về pong", async () => {
    // Dùng supertest để gửi request GET đến '/api/ping' trên app của bạn
    const response = await request(app).get("/api/ping");

    // Kiểm tra status code có phải là 200 (OK) không
    expect(response.statusCode).toBe(200);

    // Kiểm tra body của response có đúng là object { message: 'pong from backend!' } không
    expect(response.body).toEqual({ message: "pong from backend!" });
    // Dùng toEqual để so sánh object hoặc array
  });

  // Test cho endpoint GET /api/profiles/:username

  // Trường hợp thành công (giả sử user 'huytest' tồn tại trong DB dev của bạn)
  it("GET /api/profiles/huytest - nên trả về thông tin profile công khai", async () => {
    const response = await request(app).get("/api/profiles/huytest"); // Thay 'huytest' bằng username có thật trong DB dev

    expect(response.statusCode).toBe(200);
    // Kiểm tra các key cơ bản phải có trong response
    expect(response.body).toHaveProperty("user");
    expect(response.body).toHaveProperty("profile");
    expect(response.body).toHaveProperty("links");
    // Kiểm tra cụ thể hơn nếu muốn (ví dụ: user.username phải là 'huytest')
    expect(response.body.user.username).toBe("huytest");
  });

  // Trường hợp user không tồn tại
  it("GET /api/profiles/user_khong_ton_tai - nên trả về 404", async () => {
    const response = await request(app).get(
      "/api/profiles/user_khong_ton_tai_abcxyz"
    ); // Dùng một username chắc chắn không có

    expect(response.statusCode).toBe(404);
    expect(response.body).toEqual({ message: "User not found" }); // Kiểm tra message lỗi trả về
  });
  afterAll(async () => {
    // Đợi cho kết nối Mongoose đóng hoàn toàn
    await mongoose.connection.close();
    console.log("Mongoose connection closed after tests."); // Log này để bạn biết nó đã chạy (tùy chọn)
  });
  // Hook này sẽ chạy một lần duy nhất sau khi tất cả các test trong file này hoàn thành
});

