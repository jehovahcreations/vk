const categoryService = require("../services/category.service");
const { addFlash } = require("../utils/flashMessages");

async function renderList(req, res) {
  const search = req.query.search || "";
  const status = req.query.status || "";

  const categories = await categoryService.listCategories({ search, status });

  res.render("admin/categories/index", {
    categories,
    filters: { search, status }
  });
}

function renderNew(req, res) {
  res.render("admin/categories/form", {
    pageTitle: "Create Category",
    action: "/admin/categories",
    category: { name: "", slug: "", description: "" },
    submitLabel: "Create category"
  });
}

async function renderEdit(req, res) {
  const category = await categoryService.getCategoryById(req.params.id);
  if (!category) {
    addFlash(req, "error", "Category not found.");
    return res.redirect("/admin/categories");
  }
  return res.render("admin/categories/form", {
    pageTitle: "Edit Category",
    action: `/admin/categories/${category.id}/update`,
    category,
    submitLabel: "Update category"
  });
}

async function handleCreate(req, res) {
  try {
    await categoryService.createCategory({
      name: req.body.name,
      slug: req.body.slug,
      description: req.body.description
    });
    addFlash(req, "success", "Category created.");
    return res.redirect("/admin/categories");
  } catch (error) {
    addFlash(req, "error", error.message || "Failed to create category.");
    return res.render("admin/categories/form", {
      pageTitle: "Create Category",
      action: "/admin/categories",
      category: {
        name: req.body.name || "",
        slug: req.body.slug || "",
        description: req.body.description || ""
      },
      submitLabel: "Create category"
    });
  }
}

async function handleUpdate(req, res) {
  try {
    await categoryService.updateCategory({
      id: req.params.id,
      name: req.body.name,
      slug: req.body.slug,
      description: req.body.description
    });
    addFlash(req, "success", "Category updated.");
    return res.redirect("/admin/categories");
  } catch (error) {
    addFlash(req, "error", error.message || "Failed to update category.");
    return res.redirect(`/admin/categories/${req.params.id}/edit`);
  }
}

async function handleToggle(req, res) {
  try {
    await categoryService.toggleCategory(req.params.id);
    addFlash(req, "success", "Category status updated.");
  } catch (error) {
    addFlash(req, "error", "Failed to update category status.");
  }
  return res.redirect("/admin/categories");
}

module.exports = {
  renderList,
  renderNew,
  renderEdit,
  handleCreate,
  handleUpdate,
  handleToggle
};
