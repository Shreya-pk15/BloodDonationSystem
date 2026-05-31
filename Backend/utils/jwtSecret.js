/** Shared JWT secret — must match between sign and verify */
function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET is required in production");
  }
  return "default_secret";
}

module.exports = { getJwtSecret };
