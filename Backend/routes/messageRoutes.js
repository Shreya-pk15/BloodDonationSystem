const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const {
  getPresence,
  getConversations,
  getContacts,
  startConversation,
  getConversationMessages,
  markConversationRead,
  shareLocation,
  postMessage,
} = require("../controllers/messageController");

router.use(authMiddleware);

router.get("/presence", getPresence);
router.get("/conversations", getConversations);
router.get("/contacts", getContacts);
router.post("/conversations", startConversation);
router.get("/conversations/:id/messages", getConversationMessages);
router.put("/conversations/:id/read", markConversationRead);
router.post("/conversations/:id/location", shareLocation);
router.post("/conversations/:id/messages", postMessage);

module.exports = router;
