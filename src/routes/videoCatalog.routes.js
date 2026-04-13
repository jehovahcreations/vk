const express = require("express");
const requireStudent = require("../middlewares/requireStudent");
const videoCatalogController = require("../controllers/videoCatalog.controller");

const router = express.Router();

router.get("/videos", videoCatalogController.renderList);
router.get("/offer/:code", videoCatalogController.renderPublicOffer);
router.get("/videos/:slug", requireStudent, videoCatalogController.renderWatch);

module.exports = router;
