const authService = require("../services/auth.service");
const userRepository = require("../repositories/user.repository");
const { addFlash } = require("../utils/flashMessages");
const {
  validateRegistration,
  validateLogin,
  validateForgotPassword,
  validateResetPassword
} = require("../middlewares/validation.middleware");

function renderLogin(req, res) {
  res.render("auth/login", {
    formData: { identifier: "" }
  });
}

function renderRegister(req, res) {
  res.render("auth/register", {
    formData: {
      full_name: "",
      email: "",
      phone: "",
      referral_code: req.query.ref || ""
    }
  });
}

function renderForgotPassword(req, res) {
  res.render("auth/forgot-password", { formData: { email: "" } });
}

function renderResetPassword(req, res) {
  res.render("auth/reset-password", { token: req.params.token });
}

function renderAccessDenied(req, res) {
  res.status(403).render("auth/access-denied");
}

async function handleRegister(req, res) {
  const errors = validateRegistration(req.body);
  if (errors.length) {
    errors.forEach((message) => addFlash(req, "error", message));
    return res.render("auth/register", {
      formData: {
        full_name: req.body.full_name,
        email: req.body.email,
        phone: req.body.phone,
        referral_code: req.body.referral_code
      }
    });
  }

  const existingEmail = await userRepository.findByEmail(req.body.email);
  const existingPhone = await userRepository.findByPhone(req.body.phone);
  if (existingEmail) {
    addFlash(req, "error", "Email is already in use.");
  }
  if (existingPhone) {
    addFlash(req, "error", "Phone is already in use.");
  }
  if (existingEmail || existingPhone) {
    return res.render("auth/register", {
      formData: {
        full_name: req.body.full_name,
        email: req.body.email,
        phone: req.body.phone,
        referral_code: req.body.referral_code
      }
    });
  }

  try {
    const user = await authService.registerUser({
      fullName: req.body.full_name.trim(),
      email: req.body.email.trim(),
      phone: req.body.phone.trim(),
      password: req.body.password,
      referralCode: req.body.referral_code?.trim() || null
    });

    req.session.regenerate((err) => {
      if (err) {
        addFlash(req, "error", "Please login again.");
        return res.redirect("/login");
      }
      req.session.user = {
        id: user.id,
        role: user.role,
        is_reseller: user.is_reseller,
        full_name: user.full_name,
        email: user.email,
        affiliate_code: user.affiliate_code
      };
      return res.redirect("/student/dashboard");
    });
  } catch (error) {
    if (error.code === "REFERRAL_INVALID") {
      addFlash(req, "error", "Referral code is not valid.");
      return res.render("auth/register", {
        formData: {
          full_name: req.body.full_name,
          email: req.body.email,
          phone: req.body.phone,
          referral_code: req.body.referral_code
        }
      });
    }
    addFlash(req, "error", "Registration failed. Please try again.");
    return res.render("auth/register", {
      formData: {
        full_name: req.body.full_name,
        email: req.body.email,
        phone: req.body.phone,
        referral_code: req.body.referral_code
      }
    });
  }
}

async function handleLogin(req, res) {
  const errors = validateLogin(req.body);
  if (errors.length) {
    errors.forEach((message) => addFlash(req, "error", message));
    return res.render("auth/login", { formData: { identifier: req.body.identifier } });
  }

  try {
    const user = await authService.authenticateUser({
      identifier: req.body.identifier.trim(),
      password: req.body.password
    });

    if (!user) {
      addFlash(req, "error", "Invalid credentials.");
      return res.render("auth/login", { formData: { identifier: req.body.identifier } });
    }

    req.session.regenerate((err) => {
      if (err) {
        addFlash(req, "error", "Please login again.");
        return res.redirect("/login");
      }
      req.session.user = {
        id: user.id,
        role: user.role,
        is_reseller: user.is_reseller,
        full_name: user.full_name,
        email: user.email,
        affiliate_code: user.affiliate_code
      };
      if (user.role === "admin") {
        return res.redirect("/admin/dashboard");
      }
      return res.redirect("/student/dashboard");
    });
  } catch (error) {
    if (error.code === "INACTIVE") {
      addFlash(req, "error", "Your account is inactive. Contact support.");
      return res.render("auth/login", { formData: { identifier: req.body.identifier } });
    }
    addFlash(req, "error", "Login failed. Please try again.");
    return res.render("auth/login", { formData: { identifier: req.body.identifier } });
  }
}

function handleLogout(req, res) {
  req.session.destroy(() => {
    res.clearCookie("vk.sid");
    res.redirect("/login");
  });
}

async function handleForgotPassword(req, res) {
  const errors = validateForgotPassword(req.body);
  if (errors.length) {
    errors.forEach((message) => addFlash(req, "error", message));
    return res.render("auth/forgot-password", { formData: { email: req.body.email } });
  }

  const { token } = await authService.createPasswordReset(req.body.email.trim());
  if (token) {
    console.log("Password reset link:", `${req.protocol}://${req.get("host")}/reset-password/${token}`);
  }

  addFlash(req, "success", "If that email exists, a reset link was sent.");
  return res.render("auth/forgot-password", { formData: { email: "" } });
}

async function handleResetPassword(req, res) {
  const errors = validateResetPassword(req.body);
  if (errors.length) {
    errors.forEach((message) => addFlash(req, "error", message));
    return res.render("auth/reset-password", { token: req.params.token });
  }

  const success = await authService.resetPassword({
    token: req.params.token,
    newPassword: req.body.password
  });

  if (!success) {
    addFlash(req, "error", "Reset link is invalid or expired.");
    return res.render("auth/reset-password", { token: req.params.token });
  }

  addFlash(req, "success", "Password updated. Please login.");
  return res.redirect("/login");
}

module.exports = {
  renderLogin,
  renderRegister,
  renderForgotPassword,
  renderResetPassword,
  renderAccessDenied,
  handleRegister,
  handleLogin,
  handleLogout,
  handleForgotPassword,
  handleResetPassword
};
