const express = require("express");
const requireAdmin = require("../middlewares/requireAdmin");
const adminStudentController = require("../controllers/adminStudent.controller");

const router = express.Router();

router.get("/", requireAdmin, adminStudentController.renderList);
router.get("/new", requireAdmin, adminStudentController.renderNew);
router.post("/", requireAdmin, adminStudentController.handleCreate);
router.get("/:id/edit", requireAdmin, adminStudentController.renderEdit);
router.post("/:id/update", requireAdmin, adminStudentController.handleUpdate);
router.post("/:id/toggle", requireAdmin, adminStudentController.handleToggle);

module.exports = router;
