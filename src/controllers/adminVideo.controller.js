const videoService = require("../services/video.service");
const categoryService = require("../services/category.service");
const { addFlash } = require("../utils/flashMessages");

async function renderList(req, res) {
  const search = req.query.search || "";
  const status = req.query.status || "";

  const videos = await videoService.listVideos({ search, status });

  res.render("admin/videos/index", {
    videos,
    filters: { search, status }
  });
}

async function renderNew(req, res) {
  const categories = await categoryService.listCategories({ search: "", status: "active" });
  res.render("admin/videos/form", {
    pageTitle: "Add Video",
    action: "/admin/videos",
    categories,
    video: {
      title: "",
      slug: "",
      description: "",
      thumbnail_url: "",
      video_url: "",
      category_id: "",
      price_in_paise: "",
      is_active: true
    },
    submitLabel: "Create video"
  });
}

async function renderEdit(req, res) {
  const video = await videoService.getVideoById(req.params.id);
  if (!video) {
    addFlash(req, "error", "Video not found.");
    return res.redirect("/admin/videos");
  }
  const categories = await categoryService.listCategories({ search: "", status: "active" });
  return res.render("admin/videos/form", {
    pageTitle: "Edit Video",
    action: `/admin/videos/${video.id}/update`,
    categories,
    video: {
      ...video,
      video_url: video?.metadata?.video_url || ""
    },
    submitLabel: "Update video"
  });
}

async function handleCreate(req, res) {
  try {
    const thumbnailUrl = req.file ? `/uploads/videos/${req.file.filename}` : req.body.thumbnail_url;
    await videoService.createVideo({
      title: req.body.title,
      slug: req.body.slug,
      description: req.body.description,
      thumbnail_url: thumbnailUrl,
      video_url: req.body.video_url,
      category_id: req.body.category_id || null,
      price_inr: req.body.price_inr,
      is_active: req.body.is_active === "on"
    });
    addFlash(req, "success", "Video created.");
    return res.redirect("/admin/videos");
  } catch (error) {
    addFlash(req, "error", error.message || "Failed to create video.");
    const categories = await categoryService.listCategories({ search: "", status: "active" });
    return res.render("admin/videos/form", {
      pageTitle: "Add Video",
      action: "/admin/videos",
      categories,
      video: {
        title: req.body.title || "",
        slug: req.body.slug || "",
        description: req.body.description || "",
        thumbnail_url: req.body.thumbnail_url || "",
        video_url: req.body.video_url || "",
        category_id: req.body.category_id || "",
        price_in_paise: req.body.price_inr ? Number(req.body.price_inr) * 100 : "",
        is_active: req.body.is_active === "on"
      },
      submitLabel: "Create video"
    });
  }
}

async function handleUpdate(req, res) {
  try {
    const thumbnailUrl = req.file ? `/uploads/videos/${req.file.filename}` : req.body.thumbnail_url;
    await videoService.updateVideo({
      id: req.params.id,
      title: req.body.title,
      slug: req.body.slug,
      description: req.body.description,
      thumbnail_url: thumbnailUrl,
      video_url: req.body.video_url,
      category_id: req.body.category_id || null,
      price_inr: req.body.price_inr,
      is_active: req.body.is_active === "on"
    });
    addFlash(req, "success", "Video updated.");
    return res.redirect("/admin/videos");
  } catch (error) {
    addFlash(req, "error", error.message || "Failed to update video.");
    return res.redirect(`/admin/videos/${req.params.id}/edit`);
  }
}

async function handleToggle(req, res) {
  try {
    await videoService.toggleVideo(req.params.id);
    addFlash(req, "success", "Video status updated.");
  } catch (error) {
    addFlash(req, "error", "Failed to update video status.");
  }
  return res.redirect("/admin/videos");
}

module.exports = {
  renderList,
  renderNew,
  renderEdit,
  handleCreate,
  handleUpdate,
  handleToggle
};
