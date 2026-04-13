const userRepository = require("../repositories/user.repository");
const authRepository = require("../repositories/auth.repository");
const { hashPassword, verifyPassword } = require("../utils/password");
const { generateAffiliateCode } = require("../utils/affiliateCode");
const { generateToken, hashToken } = require("../utils/token");
const referralService = require("./referral.service");

async function generateUniqueAffiliateCode() {
  let code = generateAffiliateCode();
  let existing = await userRepository.findByAffiliateCode(code);
  while (existing) {
    code = generateAffiliateCode();
    existing = await userRepository.findByAffiliateCode(code);
  }
  return code;
}

async function registerUser({ fullName, email, phone, password, referralCode }) {
  const passwordHash = await hashPassword(password);
  const affiliateCode = await generateUniqueAffiliateCode();

  let referredByUserId = null;
  let referralType = null;
  let adminReferralId = null;
  if (referralCode) {
    const normalizedReferral = referralCode.trim().toUpperCase();
    const referringUser = await userRepository.findByAffiliateCode(normalizedReferral);
    if (referringUser) {
      referredByUserId = referringUser.id;
      referralType = "student";
    } else {
      const adminReferral = await referralService.getReferralByCode(normalizedReferral);
      if (!adminReferral || !adminReferral.is_active) {
        const error = new Error("Invalid referral code.");
        error.code = "REFERRAL_INVALID";
        throw error;
      }
      referralType = "admin";
      adminReferralId = adminReferral.id;
    }
  }

  const user = await userRepository.createUser({
    full_name: fullName,
    email,
    phone,
    password_hash: passwordHash,
    role: "student",
    is_reseller: false,
    affiliate_code: affiliateCode,
    referred_by_user_id: referredByUserId,
    referral_type: referralType,
    admin_referral_id: adminReferralId,
    is_active: true,
    is_verified: true,
    profile_image: null
  });

  return user;
}

async function authenticateUser({ identifier, password }) {
  const user = await userRepository.findByEmailOrPhone(identifier);
  if (!user) {
    return null;
  }
  if (!user.is_active) {
    const error = new Error("Account is inactive.");
    error.code = "INACTIVE";
    throw error;
  }
  const isValid = await verifyPassword(password, user.password_hash);
  if (!isValid) {
    return null;
  }
  return user;
}

async function createPasswordReset(email) {
  const user = await userRepository.findByEmail(email);
  if (!user) {
    return { token: null };
  }

  const token = generateToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + 1000 * 60 * 30);

  await authRepository.createPasswordResetToken({
    userId: user.id,
    tokenHash,
    expiresAt
  });

  return { token, user };
}

async function resetPassword({ token, newPassword }) {
  const tokenHash = hashToken(token);
  const resetRecord = await authRepository.findValidPasswordResetToken(tokenHash);
  if (!resetRecord) {
    return null;
  }

  const passwordHash = await hashPassword(newPassword);
  await userRepository.updatePassword(resetRecord.user_id, passwordHash);
  await authRepository.markPasswordResetTokenUsed(resetRecord.id);

  return true;
}

module.exports = {
  registerUser,
  authenticateUser,
  createPasswordReset,
  resetPassword
};
