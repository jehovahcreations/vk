const videoService = require("../services/video.service");
const affiliateLinkService = require("../services/affiliateLink.service");
const { toGoogleDriveEmbedUrl, toGoogleDriveStreamUrl, toGoogleDriveViewUrl, extractGoogleDriveId } = require("../utils/googleDrive");
const { addFlash } = require("../utils/flashMessages");

async function renderList(req, res) {
  const search = req.query.search || "";

  const videos = await videoService.listActiveVideos({ search });

  res.render("videos", {
    videos,
    filters: { search }
  });
}

async function renderWatch(req, res) {
  const video = await videoService.getActiveVideoBySlug(req.params.slug);
  if (!video) {
    addFlash(req, "error", "Video not found.");
    return res.redirect("/videos");
  }

  const videoUrl = video?.metadata?.video_url || "";
  const driveId = extractGoogleDriveId(videoUrl);
  const streamUrl = driveId ? toGoogleDriveStreamUrl(videoUrl) : videoUrl;
  const embedUrl = toGoogleDriveEmbedUrl(videoUrl) || videoUrl;
  const driveStreamCandidates = driveId
    ? [toGoogleDriveStreamUrl(videoUrl), toGoogleDriveViewUrl(videoUrl)].filter(Boolean)
    : [];

  return res.render("watch", {
    video,
    videoUrl,
    embedUrl,
    streamUrl,
    driveStreamCandidates,
    driveId,
    isDriveVideo: Boolean(driveId)
  });
}

async function renderPublicOffer(req, res) {
  try {
    const offer = await affiliateLinkService.getPublicOffer(req.params.code, req);
    if (!offer) {
      addFlash(req, "error", "Offer link is invalid or inactive.");
      return res.redirect("/videos");
    }

    return res.render("offer", {
      offer: offer.link,
      amounts: offer.amounts
    });
  } catch (error) {
    addFlash(req, "error", "Offer links are not available right now.");
    return res.redirect("/videos");
  }
}

module.exports = {
  renderList,
  renderWatch,
  renderPublicOffer
};
