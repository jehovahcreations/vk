const videoRepository = require("../repositories/video.repository");
const categoryService = require("./category.service");
const { slugify } = require("../utils/slug");

function parsePriceToPaise(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) {
    const error = new Error("Price must be a valid number.");
    error.code = "PRICE_INVALID";
    throw error;
  }
  return Math.round(amount * 100);
}

async function getUniqueSlug(baseSlug, excludeId = null) {
  let slug = baseSlug;
  let index = 2;
  let exists = excludeId
    ? await videoRepository.findBySlugExcludingId(slug, excludeId)
    : await videoRepository.findBySlug(slug);

  while (exists) {
    slug = `${baseSlug}-${index}`;
    index += 1;
    exists = excludeId
      ? await videoRepository.findBySlugExcludingId(slug, excludeId)
      : await videoRepository.findBySlug(slug);
  }

  return slug;
}

async function createVideo({
  title,
  slug,
  description,
  thumbnail_url,
  price_inr,
  is_active,
  video_url,
  category_id
}) {
  if (!title || title.trim().length < 2) {
    throw new Error("Title must be at least 2 characters.");
  }

  const baseSlug = slugify(slug || title);
  if (!baseSlug) {
    throw new Error("Slug is required.");
  }

  const finalSlug = await getUniqueSlug(baseSlug);
  const priceInPaise = parsePriceToPaise(price_inr);

  let categoryId = null;
  if (category_id) {
    const category = await categoryService.getCategoryById(category_id);
    if (!category) {
      throw new Error("Category not found.");
    }
    categoryId = category.id;
  }

  return videoRepository.createVideo({
    title: title.trim(),
    slug: finalSlug,
    description: description?.trim() || null,
    thumbnail_url: thumbnail_url?.trim() || null,
    price_in_paise: priceInPaise,
    currency: "INR",
    is_active: Boolean(is_active),
    category_id: categoryId,
    metadata: {
      video_url: video_url?.trim() || null
    }
  });
}

async function updateVideo({
  id,
  title,
  slug,
  description,
  thumbnail_url,
  price_inr,
  is_active,
  video_url,
  category_id
}) {
  if (!title || title.trim().length < 2) {
    throw new Error("Title must be at least 2 characters.");
  }

  const baseSlug = slugify(slug || title);
  if (!baseSlug) {
    throw new Error("Slug is required.");
  }

  const finalSlug = await getUniqueSlug(baseSlug, id);
  const priceInPaise = parsePriceToPaise(price_inr);

  let categoryId = null;
  if (category_id) {
    const category = await categoryService.getCategoryById(category_id);
    if (!category) {
      throw new Error("Category not found.");
    }
    categoryId = category.id;
  }

  return videoRepository.updateVideo({
    id,
    title: title.trim(),
    slug: finalSlug,
    description: description?.trim() || null,
    thumbnail_url: thumbnail_url?.trim() || null,
    price_in_paise: priceInPaise,
    currency: "INR",
    is_active: Boolean(is_active),
    category_id: categoryId,
    metadata: {
      video_url: video_url?.trim() || null
    }
  });
}

async function toggleVideo(id) {
  return videoRepository.toggleVideo(id);
}

async function listVideos({ search, status }) {
  return videoRepository.listVideos({ search, status });
}

async function listActiveVideos({ search }) {
  return videoRepository.listActiveVideos({ search });
}

async function getVideoById(id) {
  return videoRepository.findById(id);
}

async function getActiveVideoBySlug(slug) {
  return videoRepository.findActiveBySlug(slug);
}

module.exports = {
  createVideo,
  updateVideo,
  toggleVideo,
  listVideos,
  listActiveVideos,
  getVideoById,
  getActiveVideoBySlug
};
