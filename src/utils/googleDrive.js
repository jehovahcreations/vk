function extractGoogleDriveId(url) {
  if (!url) {
    return null;
  }

  const fileMatch = url.match(/drive\.google\.com\/file\/d\/([^/]+)/i);
  if (fileMatch && fileMatch[1]) {
    return fileMatch[1];
  }

  const idMatch = url.match(/[?&]id=([^&]+)/i);
  if (idMatch && idMatch[1]) {
    return idMatch[1];
  }

  return null;
}

function toGoogleDriveEmbedUrl(url) {
  const id = extractGoogleDriveId(url);
  if (!id) {
    return null;
  }
  return `https://drive.google.com/file/d/${id}/preview`;
}

function toGoogleDriveStreamUrl(url) {
  const id = extractGoogleDriveId(url);
  if (!id) {
    return null;
  }
  return `https://drive.google.com/uc?export=download&id=${id}`;
}

function toGoogleDriveViewUrl(url) {
  const id = extractGoogleDriveId(url);
  if (!id) {
    return null;
  }
  return `https://drive.google.com/uc?export=view&id=${id}`;
}

module.exports = {
  extractGoogleDriveId,
  toGoogleDriveEmbedUrl,
  toGoogleDriveStreamUrl,
  toGoogleDriveViewUrl
};
