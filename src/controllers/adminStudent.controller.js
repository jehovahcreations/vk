const studentService = require("../services/student.service");
const { addFlash } = require("../utils/flashMessages");

async function renderList(req, res) {
  const search = req.query.search || "";
  const status = req.query.status || "";

  const students = await studentService.listStudents({ search, status });

  res.render("admin/students/index", {
    students,
    filters: { search, status }
  });
}

function renderNew(req, res) {
  res.render("admin/students/form", {
    pageTitle: "Add Student",
    action: "/admin/students",
    student: {
      full_name: "",
      email: "",
      phone: "",
      is_reseller: false,
      commission_percent: 0,
      is_active: true
    },
    submitLabel: "Create student"
  });
}

async function renderEdit(req, res) {
  const student = await studentService.getStudentById(req.params.id);
  if (!student) {
    addFlash(req, "error", "Student not found.");
    return res.redirect("/admin/students");
  }
  return res.render("admin/students/form", {
    pageTitle: "Edit Student",
    action: `/admin/students/${student.id}/update`,
    student,
    submitLabel: "Update student"
  });
}

async function handleCreate(req, res) {
  try {
    await studentService.createStudent({
      full_name: req.body.full_name,
      email: req.body.email,
      phone: req.body.phone,
      password: req.body.password,
      is_reseller: req.body.is_reseller === "on",
      commission_percent: req.body.commission_percent,
      is_active: req.body.is_active === "on"
    });
    addFlash(req, "success", "Student created.");
    return res.redirect("/admin/students");
  } catch (error) {
    addFlash(req, "error", error.message || "Failed to create student.");
    return res.render("admin/students/form", {
      pageTitle: "Add Student",
      action: "/admin/students",
      student: {
        full_name: req.body.full_name || "",
        email: req.body.email || "",
        phone: req.body.phone || "",
        is_reseller: req.body.is_reseller === "on",
        commission_percent: req.body.commission_percent || 0,
        is_active: req.body.is_active === "on"
      },
      submitLabel: "Create student"
    });
  }
}

async function handleUpdate(req, res) {
  try {
    await studentService.updateStudent({
      id: req.params.id,
      full_name: req.body.full_name,
      email: req.body.email,
      phone: req.body.phone,
      password: req.body.password || "",
      is_reseller: req.body.is_reseller === "on",
      commission_percent: req.body.commission_percent,
      is_active: req.body.is_active === "on"
    });
    addFlash(req, "success", "Student updated.");
    return res.redirect("/admin/students");
  } catch (error) {
    addFlash(req, "error", error.message || "Failed to update student.");
    return res.redirect(`/admin/students/${req.params.id}/edit`);
  }
}

async function handleToggle(req, res) {
  try {
    await studentService.toggleStudent(req.params.id);
    addFlash(req, "success", "Student status updated.");
  } catch (error) {
    addFlash(req, "error", "Failed to update student status.");
  }
  return res.redirect("/admin/students");
}

module.exports = {
  renderList,
  renderNew,
  renderEdit,
  handleCreate,
  handleUpdate,
  handleToggle
};
