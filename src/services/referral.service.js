const referralRepository = require("../repositories/referral.repository");
const { generateAffiliateCode } = require("../utils/affiliateCode");

function normalizeCode(code) {
  return code.replace(/\s+/g, "").toUpperCase();
}

async function generateUniqueCode() {
  let code = generateAffiliateCode(8);
  let existing = await referralRepository.findByCode(code);
  while (existing) {
    code = generateAffiliateCode(8);
    existing = await referralRepository.findByCode(code);
  }
  return code;
}

async function createReferral({ code, name, description }) {
  let finalCode = code ? normalizeCode(code) : null;

  if (!finalCode) {
    finalCode = await generateUniqueCode();
  }

  if (!/^[A-Z0-9]{6,16}$/.test(finalCode)) {
    const error = new Error("Referral code must be 6-16 uppercase letters or numbers.");
    error.code = "CODE_INVALID";
    throw error;
  }

  const existing = await referralRepository.findByCode(finalCode);
  if (existing) {
    const error = new Error("Referral code already exists.");
    error.code = "CODE_EXISTS";
    throw error;
  }

  return referralRepository.createReferral({
    code: finalCode,
    name,
    description
  });
}

async function updateReferral({ id, name, description }) {
  return referralRepository.updateReferral({ id, name, description });
}

async function toggleReferral(id) {
  return referralRepository.toggleReferral(id);
}

async function listReferrals({ search, status }) {
  return referralRepository.listReferrals({ search, status });
}

async function getReferralStats() {
  return referralRepository.getReferralStats();
}

async function getReferralById(id) {
  return referralRepository.findById(id);
}

async function getReferralByCode(code) {
  if (!code) {
    return null;
  }
  return referralRepository.findByCode(normalizeCode(code));
}

module.exports = {
  createReferral,
  updateReferral,
  toggleReferral,
  listReferrals,
  getReferralStats,
  getReferralById,
  getReferralByCode
};
