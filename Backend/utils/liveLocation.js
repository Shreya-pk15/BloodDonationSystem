/** Active live location shares keyed by userId */
const shares = new Map();

function startShare(userId, data) {
  const key = String(userId);
  shares.set(key, {
    conversationId: String(data.conversationId),
    recipientId: String(data.recipientId),
    lat: data.lat,
    lng: data.lng,
    city: data.city || "",
    updatedAt: Date.now(),
  });
  return shares.get(key);
}

function updateShare(userId, { lat, lng, city }) {
  const key = String(userId);
  const current = shares.get(key);
  if (!current) return null;
  if (lat != null) current.lat = lat;
  if (lng != null) current.lng = lng;
  if (city != null) current.city = city;
  current.updatedAt = Date.now();
  return current;
}

function stopShare(userId) {
  const key = String(userId);
  const current = shares.get(key);
  shares.delete(key);
  return current;
}

function getShare(userId) {
  return shares.get(String(userId)) || null;
}

function isSharing(userId) {
  return shares.has(String(userId));
}

module.exports = {
  startShare,
  updateShare,
  stopShare,
  getShare,
  isSharing,
};
