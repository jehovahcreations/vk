const categoryRepository = require("../repositories/category.repository");
const { slugify } = require("../utils/slug");

function normalizeName(name) {
  return name?.trim() || "";
}

async function getUniqueSlug(baseSlug, excludeId = null) {
  let slug = baseSlug;
  let index = 2;
  let exists = excludeId
    ? await categoryRepository.findBySlugExcludingId(slug, excludeId)
    : await categoryRepository.findBySlug(slug);

  while (exists) {
    slug = `${baseSlug}-${index}`;
    index += 1;
    exists = excludeId
      ? await categoryRepository.findBySlugExcludingId(slug, excludeId)
      : await categoryRepository.findBySlug(slug);
  }

  return slug;
}

async function createCategory({ name, slug, description }) {
  const finalName = normalizeName(name);
  if (!finalName || finalName.length < 2) {
    const error = new Error("Category name must be at least 2 characters.");
    error.code = "NAME_INVALID";
    throw error;
  }

  const baseSlug = slugify(slug || finalName);
  if (!baseSlug) {
    const error = new Error("Category slug is required.");
    error.code = "SLUG_INVALID";
    throw error;
  }

  const finalSlug = await getUniqueSlug(baseSlug);

  return categoryRepository.createCategory({
    name: finalName,
    slug: finalSlug,
    description: description?.trim() || null
  });
}

async function updateCategory({ id, name, slug, description }) {
  const finalName = normalizeName(name);
  if (!finalName || finalName.length < 2) {
    const error = new Error("Category name must be at least 2 characters.");
    error.code = "NAME_INVALID";
    throw error;
  }

  const baseSlug = slugify(slug || finalName);
  if (!baseSlug) {
    const error = new Error("Category slug is required.");
    error.code = "SLUG_INVALID";
    throw error;
  }

  const finalSlug = await getUniqueSlug(baseSlug, id);

  return categoryRepository.updateCategory({
    id,
    name: finalName,
    slug: finalSlug,
    description: description?.trim() || null
  });
}

async function toggleCategory(id) {
  return categoryRepository.toggleCategory(id);
}

async function listCategories({ search, status }) {
  return categoryRepository.listCategories({ search, status });
}

async function getCategoryById(id) {
  return categoryRepository.findById(id);
}

module.exports = {
  createCategory,
  updateCategory,
  toggleCategory,
  listCategories,
  getCategoryById
};
