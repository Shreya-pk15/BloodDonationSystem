const jwt = require("jsonwebtoken");
const { getJwtSecret } = require("./utils/jwtSecret");
const chatService = require("./services/chatService");
const presence = require("./utils/presence");
const liveLocation = require("./utils/liveLocation");

function broadcastPresence(io, userId, online) {
  io.emit("presence-update", {
    userId: String(userId),
    online,
  });
}

function setupSocket(io) {
  io.on("connection", (socket) => {
    console.log("Socket Connected:", socket.id);

    socket.on("join", (token) => {
      try {
        const decoded = jwt.verify(token, getJwtSecret());
        const userId = String(decoded.userId);

        socket.userId = userId;
        socket.userRole = decoded.role;

        socket.join(userId);
        if (decoded.role === "admin") {
          socket.join("admin");
        }

        const { becameOnline } = presence.addConnection(userId, socket.id);
        if (becameOnline) {
          broadcastPresence(io, userId, true);
        }

        socket.emit("presence-sync", {
          onlineUserIds: presence.getOnlineUserIds(),
        });

        console.log(
          "User joined room:",
          userId,
          decoded.role === "admin" ? "(+ admin)" : "",
          "| online users:",
          presence.getOnlineUserIds().length
        );
      } catch (err) {
        console.log("Socket join error:", err.message);
      }
    });

    socket.on("chat-send", async (data, ack) => {
      try {
        if (!socket.userId) {
          throw new Error("Not authenticated — reconnect and try again");
        }
        const { conversationId, body } = data || {};
        if (!conversationId || !body) {
          throw new Error("conversationId and body are required");
        }

        const { message } = await chatService.sendMessage(
          conversationId,
          socket.userId,
          body,
          io
        );

        const sender = await chatService.resolveUserDisplay(socket.userId);
        const msgPayload = {
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
        };

        if (typeof ack === "function") {
          ack({ ok: true, message: msgPayload });
        }
      } catch (err) {
        console.log("chat-send error:", err.message);
        if (typeof ack === "function") {
          ack({ ok: false, message: err.message });
        }
      }
    });

    socket.on("location-live-update", async (data, ack) => {
      try {
        if (!socket.userId) throw new Error("Not authenticated");
        const { conversationId, lat, lng, city } = data || {};
        if (!conversationId || lat == null || lng == null) {
          throw new Error("conversationId, lat, and lng are required");
        }
        const share = await chatService.updateLiveLocation(
          conversationId,
          socket.userId,
          { lat, lng, city },
          io
        );
        if (typeof ack === "function") ack({ ok: true, share });
      } catch (err) {
        if (typeof ack === "function") ack({ ok: false, message: err.message });
      }
    });

    socket.on("location-live-stop", async (data, ack) => {
      try {
        if (!socket.userId) throw new Error("Not authenticated");
        await chatService.stopLiveLocation(socket.userId, io);
        if (typeof ack === "function") ack({ ok: true });
      } catch (err) {
        if (typeof ack === "function") ack({ ok: false, message: err.message });
      }
    });

    socket.on("disconnect", () => {
      if (socket.userId) {
        const share = liveLocation.stopShare(socket.userId);
        if (share) {
          io.to(share.recipientId).emit("location-live", {
            userId: socket.userId,
            conversationId: share.conversationId,
            active: false,
          });
        }
        const { becameOffline } = presence.removeConnection(
          socket.userId,
          socket.id
        );
        if (becameOffline) {
          broadcastPresence(io, socket.userId, false);
        }
      }
      console.log("Socket Disconnected:", socket.id);
    });
  });
}

module.exports = setupSocket;
