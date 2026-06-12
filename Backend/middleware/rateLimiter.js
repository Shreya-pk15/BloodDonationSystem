const rateLimitWindowMs = 60 * 1000; // 1 minute
const maxRequestsPerWindow = 5; // limit per IP per minute

// In-memory store for request timestamps per IP
const ipRequestMap = new Map();

/**
 * Simple rate limiter middleware.
 * Limits the number of requests to auth endpoints per IP within a time window.
 * Returns 429 Too Many Requests when limit exceeded.
 */
function authRateLimiter(req, res, next) {
  const ip = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  const now = Date.now();

  if (!ipRequestMap.has(ip)) {
    ipRequestMap.set(ip, []);
  }
  const timestamps = ipRequestMap.get(ip);

  // Remove timestamps older than the window
  while (timestamps.length && now - timestamps[0] > rateLimitWindowMs) {
    timestamps.shift();
  }

  if (timestamps.length >= maxRequestsPerWindow) {
    return res.status(429).json({ message: 'Too many requests, please try again later.' });
  }

  timestamps.push(now);
  ipRequestMap.set(ip, timestamps);
  next();
}

module.exports = { authRateLimiter };
