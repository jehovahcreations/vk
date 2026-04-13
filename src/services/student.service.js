const studentRepository = require("../repositories/student.repository");
const userRepository = require("../repositories/user.repository");
const { hashPassword } = require("../utils/password");
const { generateAffiliateCode } = require("../utils/affiliateCode");

function isEmail(value) {
  return /^\S+@\S+\.\S+$/.test(value);
}

function isPhone(value) {
  return /^[0-9+\-()\s]{7,20}$/.test(value);
}

function parseCommissionPercent(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
    throw new Error("Commission percentage must be between 0 and 100.");
  }
  return Number(parsed.toFixed(2));
}

async function generateUniqueAffiliateCode() {
  let code = generateAffiliateCode();
  let existing = await userRepository.findByAffiliateCode(code);
  while (existing) {
    code = generateAffiliateCode();
    existing = await userRepository.findByAffiliateCode(code);
  }
  return code;
}

async function createStudent({ full_name, email, phone, password, is_reseller, is_active, commission_percent }) {
  if (!full_name || full_name.trim().length < 2) {
    throw new Error("Full name is required.");
  }
  if (!email || !isEmail(email)) {
    throw new Error("A valid email is required.");
  }
  if (!phone || !isPhone(phone)) {
    throw new Error("A valid phone number is required.");
  }
  if (!password || password.length < 8) {
    throw new Error("Password must be at least 8 characters.");
  }

  const existingEmail = await userRepository.findByEmail(email);
  if (existingEmail) {
    throw new Error("Email is already in use.");
  }

  const existingPhone = await userRepository.findByPhone(phone);
  if (existingPhone) {
    throw new Error("Phone is already in use.");
  }

  const commissionPercent = parseCommissionPercent(commission_percent ?? 0);

  const passwordHash = await hashPassword(password);
  const affiliateCode = await generateUniqueAffiliateCode();

  return studentRepository.createStudent({
    full_name: full_name.trim(),
    email: email.trim(),
    phone: phone.trim(),
    password_hash: passwordHash,
    role: "student",
    is_reseller: Boolean(is_reseller),
    affiliate_code: affiliateCode,
    referred_by_user_id: null,
    referral_type: null,
    admin_referral_id: null,
    commission_percent: commissionPercent,
    is_active: Boolean(is_active),
    is_verified: true,
    profile_image: null
  });
}

async function updateStudent({ id, full_name, email, phone, is_reseller, is_active, password, commission_percent }) {
  if (!full_name || full_name.trim().length < 2) {
    throw new Error("Full name is required.");
  }
  if (!email || !isEmail(email)) {
    throw new Error("A valid email is required.");
  }
  if (!phone || !isPhone(phone)) {
    throw new Error("A valid phone number is required.");
  }

  const existingEmail = await userRepository.findByEmailExcludingId(email, id);
  if (existingEmail) {
    throw new Error("Email is already in use.");
  }

  const existingPhone = await userRepository.findByPhoneExcludingId(phone, id);
  if (existingPhone) {
    throw new Error("Phone is already in use.");
  }

  const commissionPercent = parseCommissionPercent(commission_percent ?? 0);

  const updatedStudent = await studentRepository.updateStudent({
    id,
    full_name: full_name.trim(),
    email: email.trim(),
    phone: phone.trim(),
    is_reseller: Boolean(is_reseller),
    is_active: Boolean(is_active),
    commission_percent: commissionPercent
  });

  if (password) {
    if (password.length < 8) {
      throw new Error("Password must be at least 8 characters.");
    }
    const passwordHash = await hashPassword(password);
    await userRepository.updatePassword(id, passwordHash);
  }

  return updatedStudent;
}

async function toggleStudent(id) {
  return studentRepository.toggleStudent(id);
}

async function listStudents({ search, status }) {
  return studentRepository.listStudents({ search, status });
}

async function getStudentById(id) {
  return studentRepository.findById(id);
}

module.exports = {
  createStudent,
  updateStudent,
  toggleStudent,
  listStudents,
  getStudentById
};
