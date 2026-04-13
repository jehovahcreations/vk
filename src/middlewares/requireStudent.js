function requireStudent(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.redirect("/login");
  }
  if (req.session.user.role !== "student") {
    return res.redirect("/access-denied");
  }
  return next();
}

module.exports = requireStudent;
