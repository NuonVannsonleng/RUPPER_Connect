module.exports = (req, res, next) => {
  if (!["teacher", "admin"].includes(req.user?.role)) {
    return res.status(403).json({ message: "Teacher access required" });
  }

  next();
};
