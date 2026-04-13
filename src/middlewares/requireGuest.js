function requireGuest(req, res, next) {
  if (!req.session || !req.session.user) {
    return next();
  }
  if (req.session.user.role === "admin") {
    return res.redirect("/admin/dashboard");
  }
  return res.redirect("/student/dashboard");
}

module.exports = requireGuest;
