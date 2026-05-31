const chatService = require("../services/chatService");
const presence = require("../utils/presence");

const getPresence = async (req, res) => {
  try {
    res.status(200).json({ onlineUserIds: presence.getOnlineUserIds() });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getConversations = async (req, res) => {
  try {
    const list = await chatService.getConversationsForUser(req.user.userId);
    res.status(200).json(list);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getContacts = async (req, res) => {
  try {
    const contacts = await chatService.getContacts(
      req.user.userId,
      req.user.role,
      req.query.search || ""
    );
    res.status(200).json(contacts);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const startConversation = async (req, res) => {
  try {
    const { recipientId, requestId } = req.body;
    if (!recipientId) {
      return res.status(400).json({ message: "recipientId is required" });
    }

    const conversation = await chatService.findOrCreateConversation(
      req.user.userId,
      recipientId,
      requestId
    );

    const otherId = conversation.participants.find(
      (p) => p !== req.user.userId
    );
    const otherUser = await chatService.resolveUserDisplay(otherId);

    res.status(200).json({
      conversation: {
        _id: conversation._id,
        otherUser,
        lastMessage: conversation.lastMessage,
        lastMessageAt: conversation.lastMessageAt,
        requestId: conversation.requestId,
        unreadCount: 0,
      },
    });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
};

const getConversationMessages = async (req, res) => {
  try {
    const io = req.app.get("io");
    const { messages, unreadOnOpen, partnerLive, myLiveShare } =
      await chatService.getMessages(req.params.id, req.user.userId, io);
    res.status(200).json({ messages, unreadOnOpen, partnerLive, myLiveShare });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
};

const shareLocation = async (req, res) => {
  try {
    const { lat, lng, city, live } = req.body;
    const io = req.app.get("io");
    const conversationId = req.params.id;
    const userId = req.user.userId;

    if (live === false) {
      await chatService.stopLiveLocation(userId, io);
      return res.status(200).json({ sharing: false });
    }

    if (lat == null || lng == null) {
      return res
        .status(400)
        .json({ message: "Latitude and longitude are required" });
    }

    const liveLocationUtil = require("../utils/liveLocation");
    if (live && liveLocationUtil.isSharing(userId)) {
      const updated = await chatService.updateLiveLocation(
        conversationId,
        userId,
        { lat, lng, city },
        io
      );
      return res.status(200).json({ sharing: true, share: updated });
    }

    const { message } = await chatService.shareLocation(
      conversationId,
      userId,
      { lat, lng, city, isLive: !!live },
      io
    );

    const sender = await chatService.resolveUserDisplay(userId);
    res.status(201).json({
      sharing: !!live,
      message: {
        _id: message._id,
        messageType: "location",
        body: message.body,
        location: message.location,
        createdAt: message.createdAt,
        senderId: userId,
        readByOther: false,
        sender: {
          _id: sender._id,
          name: sender.name,
          role: sender.role,
        },
      },
    });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
};

const markConversationRead = async (req, res) => {
  try {
    const io = req.app.get("io");
    const { markedCount } = await chatService.markConversationAsRead(
      req.params.id,
      req.user.userId,
      io
    );
    res.status(200).json({ message: "Marked as read", markedCount });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
};

const postMessage = async (req, res) => {
  try {
    const { body } = req.body;
    const io = req.app.get("io");
    const { message } = await chatService.sendMessage(
      req.params.id,
      req.user.userId,
      body,
      io
    );

    const sender = await chatService.resolveUserDisplay(req.user.userId);

    res.status(201).json({
      message: {
        _id: message._id,
        conversationId: message.conversationId,
        senderId: message.senderId,
        body: message.body,
        createdAt: message.createdAt,
        readByOther: false,
        sender: {
          _id: sender._id,
          name: sender.name,
          role: sender.role,
        },
      },
    });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
};

module.exports = {
  getPresence,
  getConversations,
  getContacts,
  startConversation,
  getConversationMessages,
  markConversationRead,
  shareLocation,
  postMessage,
};
