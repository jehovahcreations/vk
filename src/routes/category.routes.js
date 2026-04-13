const express = require("express");
const requireAdmin = require("../middlewares/requireAdmin");
const categoryController = require("../controllers/category.controller");

const router = express.Router();

router.get("/", requireAdmin, categoryController.renderList);
router.get("/new", requireAdmin, categoryController.renderNew);
router.post("/", requireAdmin, categoryController.handleCreate);
router.get("/:id/edit", requireAdmin, categoryController.renderEdit);
router.post("/:id/update", requireAdmin, categoryController.handleUpdate);
router.post("/:id/toggle", requireAdmin, categoryController.handleToggle);

module.exports = router;
