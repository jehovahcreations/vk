const express = require("express");
const requireAdmin = require("../middlewares/requireAdmin");
const referralController = require("../controllers/referral.controller");

const router = express.Router();

router.get("/", requireAdmin, referralController.renderList);
router.get("/new", requireAdmin, referralController.renderNew);
router.post("/", requireAdmin, referralController.handleCreate);
router.get("/:id/edit", requireAdmin, referralController.renderEdit);
router.post("/:id/update", requireAdmin, referralController.handleUpdate);
router.post("/:id/toggle", requireAdmin, referralController.handleToggle);

module.exports = router;
