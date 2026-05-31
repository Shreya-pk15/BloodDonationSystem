const Conversation = require("../models/Conversation");
const Message = require("../models/Message");
const User = require("../models/User");
const Request = require("../models/Request");
const {
  ADMIN_ID,
  participantKey,
  canUsersChat,
} = require("../utils/chatAccess");
const liveLocation = require("../utils/liveLocation");

async function getConversationAccess(conversationId, userId) {
  const conversation = await Conversation.findById(conversationId);
  if (
    !conversation ||
    !conversation.participants.map(String).includes(String(userId))
  ) {
    const err = new Error("Conversation not found");
    err.status = 404;
    throw err;
  }
  const recipientId = conversation.participants.find(
    (p) => String(p) !== String(userId)
  );
  const access = await canUsersChat(userId, recipientId);
  if (!access.allowed) {
    const err = new Error(access.message);
    err.status = 403;
    throw err;
  }
  return { conversation, recipientId };
}

async function enrichMessage(msg, userId, otherId) {
  const sender = await resolveUserDisplay(msg.senderId);
  const readBy = msg.readBy || [];
  const fromOther = String(msg.senderId) !== String(userId);
  const wasUnread = fromOther && !readBy.map(String).includes(String(userId));

  return {
    _id: msg._id,
    conversationId: msg.conversationId,
    senderId: msg.senderId,
    messageType: msg.messageType || "text",
    body: msg.body,
    location: msg.location?.lat != null ? msg.location : null,
    createdAt: msg.createdAt,
    readBy,
    wasUnread,
    readByOther: otherId
      ? readBy.map(String).includes(String(otherId))
      : false,
    readByMe: readBy.map(String).includes(String(userId)),
    sender: { _id: sender._id, name: sender.name, role: sender.role },
  };
}

function buildChatPayload(message, sender) {
  return {
    conversationId: message.conversationId.toString(),
    message: {
      _id: message._id,
      conversationId: message.conversationId,
      senderId: message.senderId,
      messageType: message.messageType || "text",
      body: message.body,
      location: message.location?.lat != null ? message.location : null,
      createdAt: message.createdAt,
      readByOther: false,
      sender: { _id: sender._id, name: sender.name, role: sender.role },
    },
  };
}

async function resolveUserDisplay(userId) {
  if (userId === ADMIN_ID) {
    return {
      _id: ADMIN_ID,
      name: "System Administrator",
      role: "admin",
      email: "admin@admin.com",
    };
  }
  const user = await User.findById(userId).select("name email role");
  if (!user) return { _id: userId, name: "Unknown User", role: "user" };
  return user;
}

async function findOrCreateConversation(userId, recipientId, requestId) {
  const access = await canUsersChat(userId, recipientId);
  if (!access.allowed) {
    const err = new Error(access.message);
    err.status = 403;
    throw err;
  }

  const key = participantKey(userId, recipientId);
  let conversation = await Conversation.findOne({ participantKey: key });

  if (!conversation) {
    conversation = await Conversation.create({
      participantKey: key,
      participants: [userId, recipientId].sort(),
      requestId: requestId || null,
    });
  } else if (requestId && !conversation.requestId) {
    conversation.requestId = requestId;
    await conversation.save();
  }

  return conversation;
}

async function sendMessage(conversationId, senderId, body, io) {
  const trimmed = (body || "").trim();
  if (!trimmed) {
    const err = new Error("Message cannot be empty");
    err.status = 400;
    throw err;
  }

  const { conversation, recipientId } = await getConversationAccess(
    conversationId,
    senderId
  );

  const message = await Message.create({
    conversationId: conversation._id,
    senderId,
    messageType: "text",
    body: trimmed,
    readBy: [senderId],
  });

  conversation.lastMessage = trimmed;
  conversation.lastMessageAt = message.createdAt;
  await conversation.save();

  const sender = await resolveUserDisplay(senderId);
  const payload = buildChatPayload(message, sender);

  if (io) {
    io.to(recipientId).emit("chat-message", payload);
  }

  return { message, conversation };
}

async function shareLocation(conversationId, senderId, coords, io) {
  const { lat, lng, city, isLive } = coords;
  if (lat == null || lng == null) {
    const err = new Error("Latitude and longitude are required");
    err.status = 400;
    throw err;
  }

  const { conversation, recipientId } = await getConversationAccess(
    conversationId,
    senderId
  );

  const label = isLive
    ? `🩸 Live coordinates${city ? ` · ${city}` : ""}`
    : `🩸 Coordinates${city ? ` · ${city}` : ""}`;

  const message = await Message.create({
    conversationId: conversation._id,
    senderId,
    messageType: "location",
    body: label,
    location: { lat, lng, city: city || "", isLive: !!isLive },
    readBy: [senderId],
  });

  conversation.lastMessage = label;
  conversation.lastMessageAt = message.createdAt;
  await conversation.save();

  if (isLive) {
    liveLocation.startShare(senderId, {
      conversationId: conversation._id,
      recipientId,
      lat,
      lng,
      city: city || "",
    });
  }

  const sender = await resolveUserDisplay(senderId);
  const payload = buildChatPayload(message, sender);

  if (io) {
    io.to(recipientId).emit("chat-message", payload);
    if (isLive) {
      io.to(recipientId).emit("location-live", {
        userId: String(senderId),
        conversationId: conversation._id.toString(),
        lat,
        lng,
        city: city || "",
        active: true,
        updatedAt: Date.now(),
      });
    }
  }

  return { message, conversation };
}

async function updateLiveLocation(conversationId, userId, coords, io) {
  const { lat, lng, city } = coords;
  const share = liveLocation.getShare(userId);
  if (!share || String(share.conversationId) !== String(conversationId)) {
    const err = new Error("You are not sharing live location in this chat");
    err.status = 400;
    throw err;
  }

  liveLocation.updateShare(userId, { lat, lng, city });

  if (io) {
    io.to(share.recipientId).emit("location-live", {
      userId: String(userId),
      conversationId: String(conversationId),
      lat,
      lng,
      city: city ?? share.city,
      active: true,
      updatedAt: Date.now(),
    });
  }

  return liveLocation.getShare(userId);
}

async function stopLiveLocation(userId, io) {
  const share = liveLocation.stopShare(userId);
  if (!share) return null;

  const citySuffix = share.city ? ` · ${share.city}` : "";
  const staticLabel = `🩸 Coordinates${citySuffix}`;

  await Message.updateMany(
    {
      conversationId: share.conversationId,
      senderId: userId,
      messageType: "location",
      "location.isLive": true,
    },
    {
      $set: {
        "location.isLive": false,
        body: staticLabel,
      },
    }
  );

  if (io) {
    const payload = {
      userId: String(userId),
      conversationId: String(share.conversationId),
      active: false,
    };
    io.to(String(share.recipientId)).emit("location-live", payload);
    io.to(String(userId)).emit("location-live", payload);
  }

  return share;
}

function getPartnerLiveShare(conversationId, userId, otherId) {
  const share = liveLocation.getShare(otherId);
  if (!share || String(share.conversationId) !== String(conversationId)) {
    return null;
  }
  return {
    userId: String(otherId),
    lat: share.lat,
    lng: share.lng,
    city: share.city,
    updatedAt: share.updatedAt,
    active: true,
  };
}

function getMyLiveShare(conversationId, userId) {
  const share = liveLocation.getShare(userId);
  if (!share || String(share.conversationId) !== String(conversationId)) {
    return null;
  }
  return { active: true, lat: share.lat, lng: share.lng, city: share.city };
}

async function getConversationsForUser(userId) {
  const conversations = await Conversation.find({
    participants: userId,
  }).sort({ lastMessageAt: -1 });

  const result = [];
  for (const conv of conversations) {
    const otherId = conv.participants.find((p) => p !== userId);
    const other = await resolveUserDisplay(otherId);
    const unread = await Message.countDocuments({
      conversationId: conv._id,
      senderId: { $ne: userId },
      readBy: { $nin: [userId] },
    });
    result.push({
      _id: conv._id,
      otherUser: other,
      lastMessage: conv.lastMessage,
      lastMessageAt: conv.lastMessageAt,
      requestId: conv.requestId,
      unreadCount: unread,
    });
  }
  return result;
}

async function markConversationAsRead(conversationId, userId, io) {
  const conversation = await Conversation.findById(conversationId);
  if (!conversation || !conversation.participants.includes(userId)) {
    const err = new Error("Conversation not found");
    err.status = 404;
    throw err;
  }

  const toMark = await Message.find({
    conversationId,
    senderId: { $ne: userId },
    readBy: { $nin: [userId] },
  }).select("_id");

  const result = await Message.updateMany(
    {
      conversationId,
      senderId: { $ne: userId },
      readBy: { $nin: [userId] },
    },
    { $addToSet: { readBy: userId } }
  );

  const otherId = conversation.participants.find((p) => p !== userId);
  if (io && result.modifiedCount > 0 && otherId) {
    io.to(otherId).emit("chat-read", {
      conversationId: conversation._id.toString(),
      readBy: userId,
      messageIds: toMark.map((m) => m._id.toString()),
    });
  }

  return { markedCount: result.modifiedCount };
}

async function getMessages(conversationId, userId, io) {
  const conversation = await Conversation.findById(conversationId);
  if (!conversation || !conversation.participants.includes(userId)) {
    const err = new Error("Conversation not found");
    err.status = 404;
    throw err;
  }

  const otherId = conversation.participants.find((p) => p !== userId);

  const messages = await Message.find({ conversationId })
    .sort({ createdAt: 1 })
    .limit(200);

  let unreadOnOpen = 0;
  const enriched = [];
  for (const msg of messages) {
    const item = await enrichMessage(msg, userId, otherId);
    if (item.wasUnread) unreadOnOpen += 1;
    enriched.push(item);
  }

  const { markedCount } = await markConversationAsRead(
    conversationId,
    userId,
    io
  );

  const partnerLive = getPartnerLiveShare(conversationId, userId, otherId);
  const myLiveShare = getMyLiveShare(conversationId, userId);

  return {
    messages: enriched,
    markedCount,
    unreadOnOpen,
    partnerLive,
    myLiveShare,
  };
}

function filterContactsBySearch(contacts, search) {
  const q = (search || "").trim().toLowerCase();
  if (!q) return contacts;
  return contacts.filter((c) => {
    const hay = [c.name, c.email, c.role, c.subtitle]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });
}

async function getContacts(userId, role, search = "") {
  const contacts = [];
  const seen = new Set();

  const addContact = (c) => {
    const id = c._id?.toString() || c._id;
    if (!id || seen.has(id)) return;
    seen.add(id);
    contacts.push(c);
  };

  addContact({
    _id: ADMIN_ID,
    name: "System Administrator",
    role: "admin",
    email: "admin@admin.com",
    subtitle: "Support & moderation",
  });

  if (role === "admin") {
    const users = await User.find({ role: { $ne: "admin" } })
      .select("name email role bloodGroup")
      .sort({ name: 1 });
    users.forEach((u) =>
      addContact({
        _id: u._id,
        name: u.name,
        role: u.role,
        email: u.email,
        subtitle: u.role === "donor" ? u.bloodGroup : "Hospital",
      })
    );
    return filterContactsBySearch(contacts, search);
  }

  if (role === "donor") {
    const requests = await Request.find({ acceptedDonors: userId })
      .populate("hospitalId", "name email role")
      .sort({ updatedAt: -1 });

    requests.forEach((req) => {
      if (req.hospitalId) {
        addContact({
          _id: req.hospitalId._id,
          name: req.hospitalId.name,
          role: "hospital",
          email: req.hospitalId.email,
          subtitle: `Blood request · ${req.bloodGroup}`,
          requestId: req._id,
        });
      }
    });
  }

  if (role === "hospital") {
    const requests = await Request.find({ hospitalId: userId })
      .populate("acceptedDonors", "name email role bloodGroup")
      .sort({ updatedAt: -1 });

    requests.forEach((req) => {
      (req.acceptedDonors || []).forEach((donor) => {
        addContact({
          _id: donor._id,
          name: donor.name,
          role: "donor",
          email: donor.email,
          subtitle: `Donor · ${donor.bloodGroup || "—"}`,
          requestId: req._id,
        });
      });
    });
  }

  return filterContactsBySearch(contacts, search);
}

module.exports = {
  findOrCreateConversation,
  sendMessage,
  shareLocation,
  updateLiveLocation,
  stopLiveLocation,
  getConversationsForUser,
  getMessages,
  markConversationAsRead,
  getContacts,
  resolveUserDisplay,
  getMyLiveShare,
  getPartnerLiveShare,
};
