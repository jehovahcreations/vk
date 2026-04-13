const express = require("express");
const path = require("path");
const multer = require("multer");
const requireAdmin = require("../middlewares/requireAdmin");
const adminVideoController = require("../controllers/adminVideo.controller");

const uploadDir = path.join(__dirname, "..", "..", "public", "uploads", "videos");
const storage = multer.diskStorage({
	destination: uploadDir,
	filename: (req, file, cb) => {
		const ext = path.extname(file.originalname || ".jpg");
		const safeBase = Date.now().toString(36);
		cb(null, `${safeBase}${ext}`);
	}
});

const upload = multer({
	storage,
	limits: { fileSize: 5 * 1024 * 1024 },
	fileFilter: (req, file, cb) => {
		if (!file.mimetype || !file.mimetype.startsWith("image/")) {
			return cb(new Error("Only image uploads are allowed."));
		}
		return cb(null, true);
	}
});

const router = express.Router();

router.get("/", requireAdmin, adminVideoController.renderList);
router.get("/new", requireAdmin, adminVideoController.renderNew);
router.post("/", requireAdmin, upload.single("thumbnail_file"), adminVideoController.handleCreate);
router.get("/:id/edit", requireAdmin, adminVideoController.renderEdit);
router.post("/:id/update", requireAdmin, upload.single("thumbnail_file"), adminVideoController.handleUpdate);
router.post("/:id/toggle", requireAdmin, adminVideoController.handleToggle);

module.exports = router;
