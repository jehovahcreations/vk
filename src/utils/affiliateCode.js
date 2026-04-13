const crypto = require("crypto");

function generateAffiliateCode(length = 10) {
  const bytes = crypto.randomBytes(length);
  return bytes.toString("base64").replace(/[^A-Z0-9]/gi, "").toUpperCase().slice(0, length);
}

module.exports = {
  generateAffiliateCode
};
