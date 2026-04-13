function isEmail(value) {
  return /^\S+@\S+\.\S+$/.test(value);
}

function isPhone(value) {
  return /^[0-9+\-()\s]{7,20}$/.test(value);
}

function validateRegistration(body) {
  const errors = [];
  if (!body.full_name || body.full_name.trim().length < 2) {
    errors.push("Full name is required.");
  }
  if (!body.email || !isEmail(body.email)) {
    errors.push("A valid email is required.");
  }
  if (!body.phone || !isPhone(body.phone)) {
    errors.push("A valid phone number is required.");
  }
  if (!body.password || body.password.length < 8) {
    errors.push("Password must be at least 8 characters.");
  }
  if (body.password !== body.confirm_password) {
    errors.push("Passwords do not match.");
  }
  return errors;
}

function validateLogin(body) {
  const errors = [];
  if (!body.identifier || body.identifier.trim().length === 0) {
    errors.push("Email or phone is required.");
  }
  if (!body.password) {
    errors.push("Password is required.");
  }
  return errors;
}

function validateForgotPassword(body) {
  const errors = [];
  if (!body.email || !isEmail(body.email)) {
    errors.push("A valid email is required.");
  }
  return errors;
}

function validateResetPassword(body) {
  const errors = [];
  if (!body.password || body.password.length < 8) {
    errors.push("Password must be at least 8 characters.");
  }
  if (body.password !== body.confirm_password) {
    errors.push("Passwords do not match.");
  }
  return errors;
}

module.exports = {
  validateRegistration,
  validateLogin,
  validateForgotPassword,
  validateResetPassword
};
