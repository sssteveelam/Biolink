const express = require("express");
const router = express.Router();
const authMiddleware = require("../../middleware/authMiddleware"); // Import middleware xác thực
const Link = require("../../models/Link"); // Import Link model
const { default: mongoose } = require("mongoose"); // Import mongoose để dùng transaction (cho reorder)

// @route   GET api/user/links
// @desc    Get all links for the logged-in user
// @access  Private
router.get("/", authMiddleware, async (req, res) => {
  try {
    const links = await Link.find({ userId: req.user.userId }).sort({
      order: "asc",
    });
    res.status(200).json(links);
  } catch (error) {
    console.error("Error fetching links:", error);
    res.status(500).json({ message: "Server error fetching links" });
  }
});

// @route   POST api/user/links
// @desc    Create a new link for the logged-in user
// @access  Private
router.post("/", authMiddleware, async (req, res) => {
  const { title, url, linkType, socialPlatform } = req.body;

  const allowedTypes = ["link", "youtube", "spotify"];
  // Dùng giá trị gửi lên nếu hợp lệ, nếu không thì mặc định là 'link'
  const typeToSave =
    linkType && allowedTypes.includes(linkType) ? linkType : "link";

  // Validation đơn giản
  if (!title || !url) {
    return res.status(400).json({ message: "Title and URL are required" });
  }
  // Có thể thêm validation check URL hợp lệ ở đây

  try {
    // Tìm order lớn nhất hiện tại của user + 1 để thêm link mới vào cuối
    const lastLink = await Link.findOne({ userId: req.user.userId }).sort({
      order: "desc",
    });
    const newOrder = lastLink ? lastLink.order + 1 : 0;

    const newLink = new Link({
      userId: req.user.userId,
      title,
      url,
      order: newOrder,
      linkType: typeToSave,
      socialPlatform: socialPlatform || null, // <== Thêm vào đây, đảm bảo là null nếu không có
    });

    const savedLink = await newLink.save();
    res.status(201).json(savedLink); // 201 Created
  } catch (error) {
    console.error("Error creating link:", error);
    if (error.name === "ValidationError") {
      return res
        .status(400)
        .json({ message: "Validation Error", errors: error.errors });
    }
    res.status(500).json({ message: "Server error creating link" });
  }
});

// @route   PUT api/user/links/reorder
// @desc    Reorder links for the logged-in user
// @access  Private
// @route   PUT api/user/links/reorder
// @desc    Reorder links for the logged-in user
// @access  Private
router.put("/reorder", authMiddleware, async (req, res) => {
  console.log("--- Reorder API Start (withTransaction) ---");
  const { orderedLinkIds } = req.body;

  if (!Array.isArray(orderedLinkIds)) {
    console.log("Reorder Error: orderedLinkIds is not an array");
    return res.status(400).json({ message: "orderedLinkIds must be an array" });
  }
  console.log("Received orderedLinkIds:", orderedLinkIds);

  const session = await mongoose.startSession();
  let finalResult = null; // Variable to store result outside transaction scope if needed

  try {
    console.log("Starting session.withTransaction()...");

    // Use withTransaction for automatic commit/abort and potential retries
    finalResult = await session.withTransaction(async (currentSession) => {
      // Logic inside the transaction callback
      console.log(
        "Inside withTransaction callback - Updating links sequentially..."
      );

      for (let i = 0; i < orderedLinkIds.length; i++) {
        const linkId = orderedLinkIds[i];
        const newOrder = i;

        console.log(`Updating Link ID: ${linkId} to order ${newOrder}`);
        if (!mongoose.Types.ObjectId.isValid(linkId)) {
          console.log(`Reorder Error: Invalid ID format found: ${linkId}`);
          // Throwing an error here will automatically trigger abortTransaction
          throw new Error(`Invalid Link ID format: ${linkId}`);
        }

        // Use the session provided by the callback (currentSession)
        const result = await Link.updateOne(
          { _id: linkId, userId: req.user.userId },
          { $set: { order: newOrder } },
          { session: currentSession } // Use the callback's session
        );

        console.log(`Update result for ${linkId}:`, result);
        if (result.matchedCount === 0) {
          console.log(`Reorder Error: Link not found or not owned: ${linkId}`);
          // Throwing an error here will automatically trigger abortTransaction
          throw new Error(
            `Link with ID ${linkId} not found or not owned by user.`
          );
        }
      }
      // If the loop completes without throwing an error,
      // withTransaction will automatically commit.
      console.log("Transaction logic completed successfully within callback.");
      // Optionally return something from the callback if needed outside
      return { success: true };
    }); // End of withTransaction callback

    console.log("session.withTransaction() completed.");

    // If withTransaction completed without throwing an error
    res.status(200).json({ message: "Links reordered successfully" });
  } catch (error) {
    // Errors thrown inside withTransaction (or during commit/abort) are caught here
    console.error("--- ERROR during withTransaction ---:", error);
    res.status(500).json({
      message: "Server error reordering links",
      error: error.message, // Provide the specific error message
    });
  } finally {
    // Always end the session regardless of outcome
    if (session) {
      session.endSession();
      console.log("Session ended in finally block (withTransaction).");
    }
  }
});

// @route   PUT api/user/links/:linkId
// @desc    Update an existing link
// @access  Private
router.put("/:linkId", authMiddleware, async (req, res) => {
  const { title, url, linkType, socialPlatform } = req.body;
  const { linkId } = req.params;

  // Tạo object chứa các field cần update
  const updateFields = {};
  // Validation
  if (!title || !url) {
    return res.status(400).json({ message: "Title and URL are required" });
  } else {
    updateFields.title = title;
    updateFields.url = url;
  }

  // --- THÊM LOGIC CHO socialPlatform ---
  // Luôn cập nhật socialPlatform, nếu không gửi lên thì đặt là null
  updateFields.socialPlatform = socialPlatform || null;
  // ---------------------------------

  if (!mongoose.Types.ObjectId.isValid(linkId)) {
    return res.status(400).json({ message: "Invalid Link ID format" });
  }

  if (linkType != undefined) {
    // Validate linkType nếu cần
    const allowedTypes = ["link", "youtube", "spotify"];
    if (allowedTypes.includes(linkType)) {
      updateFields.linkType = linkType;
    } else {
      // Có thể báo lỗi hoặc bỏ qua việc update type nếu không hợp lệ
      console.warn(`Invalid linkType '${linkType}' received during update.`);
    }
  }

  try {
    const updatedLink = await Link.findOneAndUpdate(
      { _id: linkId, userId: req.user.userId }, // Đảm bảo user chỉ update link của mình
      { $set: updateFields },
      { new: true, runValidators: true }
    );

    if (!updatedLink) {
      return res
        .status(404)
        .json({ message: "Link not found or user not authorized" });
    }

    res.status(200).json(updatedLink);
  } catch (error) {
    console.error("Error updating link:", error);
    if (error.name === "ValidationError") {
      return res
        .status(400)
        .json({ message: "Validation Error", errors: error.errors });
    }
    res.status(500).json({ message: "Server error updating link" });
  }
});

// @route   DELETE api/user/links/:linkId
// @desc    Delete a link
// @access  Private
router.delete("/:linkId", authMiddleware, async (req, res) => {
  const { linkId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(linkId)) {
    return res.status(400).json({ message: "Invalid Link ID format" });
  }

  try {
    const deletedLink = await Link.findOneAndDelete({
      _id: linkId,
      userId: req.user.userId, // Đảm bảo user chỉ xóa link của mình
    });

    if (!deletedLink) {
      return res
        .status(404)
        .json({ message: "Link not found or user not authorized" });
    }

    // Sau khi xóa 1 link, có thể bạn muốn cập nhật lại 'order' của các link còn lại,
    // nhưng để đơn giản, tạm thời bỏ qua bước này.

    res.status(200).json({ message: "Link deleted successfully" }); // Hoặc 204 No Content
  } catch (error) {
    console.error("Error deleting link:", error);
    res.status(500).json({ message: "Server error deleting link" });
  }
});
// Thêm vào cuối file routes/api/links.js, trước module.exports

// @route   POST api/links/:linkId/click
// @desc    Ghi nhận một lượt click cho link
// @access  Public
router.post("/:linkId/click", async (req, res) => {
  try {
    const linkId = req.params.linkId;

    // Kiểm tra ID có hợp lệ không
    if (!mongoose.Types.ObjectId.isValid(linkId)) {
      // Không cần trả lỗi chi tiết ra ngoài, chỉ cần log lại nếu muốn
      console.warn(`Invalid linkId format for click tracking: ${linkId}`);
      return res.status(400).send(); // Trả về lỗi đơn giản
    }

    // Tìm link và tăng clickCount lên 1 một cách an toàn (atomic increment)
    // Dùng $inc để tăng giá trị field number lên 1 đơn vị
    const updatedLink = await Link.findByIdAndUpdate(linkId, {
      $inc: { clickCount: 1 },
    });

    if (!updatedLink) {
      console.warn(`Link not found for click tracking: ${linkId}`);
      return res.status(404).send();
    }

    // Ghi nhận thành công, trả về 204 No Content (không cần body) hoặc 200 OK
    res.status(204).send();
  } catch (error) {
    console.error("Error tracking link click:", error);
    // Trả về lỗi server chung chung
    res.status(500).send();
  }
});

module.exports = router;
