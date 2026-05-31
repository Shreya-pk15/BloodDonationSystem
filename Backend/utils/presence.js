/** Tracks socket connections per user for online/offline presence */
const connections = new Map();

function addConnection(userId, socketId) {
  const key = String(userId);
  if (!connections.has(key)) {
    connections.set(key, new Set());
  }
  const set = connections.get(key);
  const wasOnline = set.size > 0;
  set.add(socketId);
  return { becameOnline: !wasOnline };
}

function removeConnection(userId, socketId) {
  const key = String(userId);
  const set = connections.get(key);
  if (!set) return { becameOffline: false };
  set.delete(socketId);
  if (set.size === 0) {
    connections.delete(key);
    return { becameOffline: true };
  }
  return { becameOffline: false };
}

function getOnlineUserIds() {
  return Array.from(connections.keys());
}

function isOnline(userId) {
  const set = connections.get(String(userId));
  return !!set && set.size > 0;
}

module.exports = {
  addConnection,
  removeConnection,
  getOnlineUserIds,
  isOnline,
};
