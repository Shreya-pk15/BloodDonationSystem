import axios from "axios";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const API = "http://localhost:5000/api/messages";

const THEMES = {
  donor: { accent: "#e63946", accentDark: "#c1121f", bg: "#fff5f5", label: "Donor" },
  hospital: { accent: "#1d3557", accentDark: "#0d1b2a", bg: "#f0f4f8", label: "Hospital" },
  admin: { accent: "#e11d48", accentDark: "#be123c", bg: "#fff1f2", label: "Admin" },
};

const WA_GREEN = "#25d366";
const WA_READ_BLUE = "#53bdeb";

function getToken() {
  return typeof window !== "undefined" ? localStorage.getItem("token") : null;
}

function authHeaders() {
  return { headers: { Authorization: `Bearer ${getToken()}` } };
}

function roleIcon(role) {
  if (role === "admin") return "🛡️";
  if (role === "hospital") return "🏥";
  return "🩸";
}

function mapsLink(lat, lng) {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

function mapsEmbedUrl(lat, lng) {
  const pad = 0.008;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${lng - pad}%2C${lat - pad}%2C${lng + pad}%2C${lat + pad}&layer=mapnik&marker=${lat}%2C${lng}`;
}

function formatCoords(lat, lng) {
  return `${Number(lat).toFixed(5)}, ${Number(lng).toFixed(5)}`;
}

async function getCurrentCoords() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not supported on this device"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        }),
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 5000 }
    );
  });
}

async function reverseCity(lat, lng) {
  try {
    const res = await axios.get(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`,
      { headers: { "Accept-Language": "en" } }
    );
    const a = res.data?.address || {};
    return a.city || a.town || a.village || a.suburb || "";
  } catch {
    return "";
  }
}

/** BloodLink-style location card (not WhatsApp) */
function BloodLocationCard({ lat, lng, city, accent, accentDark, live, compact }) {
  return (
    <div
      style={{
        borderRadius: "14px",
        overflow: "hidden",
        border: `2px solid ${accent}`,
        background: "linear-gradient(135deg, #ffffff 0%, #fafafa 100%)",
        boxShadow: `0 4px 14px ${accent}22`,
      }}
    >
      <div
        style={{
          padding: compact ? "10px 12px" : "12px 14px",
          background: `linear-gradient(90deg, ${accent} 0%, ${accentDark} 100%)`,
          color: "#fff",
          display: "flex",
          alignItems: "center",
          gap: "10px",
        }}
      >
        <span style={{ fontSize: compact ? "20px" : "24px", lineHeight: 1 }}>🩸</span>
        <div>
          <div style={{ fontWeight: "800", fontSize: compact ? "12px" : "13px", letterSpacing: "0.3px" }}>
            {live ? "LIVE COORDINATES" : "COORDINATES SHARED"}
          </div>
          <div style={{ fontSize: "11px", opacity: 0.9, marginTop: "2px" }}>
            {city || "BloodLink GPS"}
          </div>
        </div>
        {live && (
          <span
            style={{
              marginLeft: "auto",
              fontSize: "10px",
              fontWeight: "800",
              padding: "4px 8px",
              borderRadius: "20px",
              background: "rgba(255,255,255,0.25)",
              animation: "blink 1.2s ease-in-out infinite",
            }}
          >
            LIVE
          </span>
        )}
      </div>
      {!compact && (
        <iframe
          title="Map"
          width="100%"
          height={130}
          style={{ border: 0, display: "block" }}
          loading="lazy"
          src={mapsEmbedUrl(lat, lng)}
        />
      )}
      <div
        style={{
          padding: "10px 12px",
          fontSize: "11px",
          color: "#475569",
          fontFamily: "ui-monospace, monospace",
          borderTop: "1px solid #f1f5f9",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "8px",
          flexWrap: "wrap",
        }}
      >
        <span>{formatCoords(lat, lng)}</span>
        <a
          href={mapsLink(lat, lng)}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: accent,
            fontWeight: "700",
            textDecoration: "none",
            fontSize: "11px",
          }}
        >
          Open map →
        </a>
      </div>
    </div>
  );
}

function PartnerTrackerCard({ share, name, accent, accentDark }) {
  if (!share?.active) return null;
  const ago = share.updatedAt
    ? Math.max(0, Math.round((Date.now() - share.updatedAt) / 1000))
    : 0;
  return (
    <div style={{ marginBottom: "14px" }}>
      <div
        style={{
          fontSize: "11px",
          fontWeight: "700",
          color: accent,
          textTransform: "uppercase",
          letterSpacing: "0.8px",
          marginBottom: "8px",
        }}
      >
        🎯 {name} is broadcasting location · {ago < 8 ? "just now" : `${ago}s ago`}
      </div>
      <BloodLocationCard
        lat={share.lat}
        lng={share.lng}
        city={share.city}
        accent={accent}
        accentDark={accentDark}
        live
      />
    </div>
  );
}

/** WhatsApp-style unread label */
function formatUnreadLabel(count) {
  const n = Number(count) || 0;
  if (n <= 0) return "";
  return n === 1 ? "1 unread message" : `${n} unread messages`;
}

/** Short count for chat list preview */
function formatMessageCount(count) {
  const n = Number(count) || 0;
  if (n <= 0) return "";
  return n === 1 ? "1 new message" : `${n} new messages`;
}

function UnreadBadge({ count, size = 22 }) {
  if (!count || count <= 0) return null;
  const label = count > 99 ? "99+" : String(count);
  return (
    <span
      style={{
        minWidth: size,
        height: size,
        padding: count > 9 ? "0 6px" : 0,
        borderRadius: size,
        background: WA_GREEN,
        color: "#fff",
        fontSize: "11px",
        fontWeight: "800",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
      }}
    >
      {label}
    </span>
  );
}

function UnreadDivider({ count }) {
  if (!count || count <= 0) return null;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        margin: "16px 0",
      }}
    >
      <span
        style={{
          background: "#fff9e6",
          color: "#54656f",
          fontSize: "12px",
          fontWeight: "600",
          padding: "6px 14px",
          borderRadius: "8px",
          boxShadow: "0 1px 2px rgba(0,0,0,0.08)",
          border: "1px solid #ffe4a0",
        }}
      >
        {formatUnreadLabel(count)}
      </span>
    </div>
  );
}

function isOnline(onlineUsers, userId) {
  if (!userId) return false;
  return onlineUsers.has(String(userId));
}

/** Green dot on avatar (WhatsApp-style) */
function AvatarWithPresence({ children, online, size = 48 }) {
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      {children}
      {online && (
        <span
          style={{
            position: "absolute",
            bottom: size <= 40 ? 0 : 2,
            right: size <= 40 ? 0 : 2,
            width: size <= 40 ? 11 : 12,
            height: size <= 40 ? 11 : 12,
            borderRadius: "50%",
            background: WA_GREEN,
            border: "2px solid #fff",
            boxSizing: "border-box",
          }}
          title="Online"
        />
      )}
    </div>
  );
}

function PresenceSubtitle({ userId, onlineUsers, unreadCount }) {
  if (unreadCount > 0) {
    return <span style={{ color: "#667781" }}>{formatUnreadLabel(unreadCount)}</span>;
  }
  if (isOnline(onlineUsers, userId)) {
    return (
      <span style={{ color: WA_GREEN, display: "inline-flex", alignItems: "center", gap: "5px", fontWeight: "500" }}>
        <span
          style={{
            width: "8px",
            height: "8px",
            borderRadius: "50%",
            background: WA_GREEN,
            display: "inline-block",
          }}
        />
        online
      </span>
    );
  }
  return <span style={{ color: "#667781" }}>offline</span>;
}

/** WhatsApp tick marks on sent messages */
function MessageTicks({ pending, readByOther }) {
  if (pending) {
    return (
      <span style={{ fontSize: "12px", opacity: 0.65, marginLeft: "4px" }} title="Sending">
        🕐
      </span>
    );
  }
  if (readByOther) {
    return (
      <span
        title="Read"
        style={{
          color: WA_READ_BLUE,
          fontSize: "15px",
          fontWeight: "700",
          letterSpacing: "-4px",
          marginLeft: "4px",
          lineHeight: 1,
        }}
      >
        ✓✓
      </span>
    );
  }
  return (
    <span
      title="Delivered"
      style={{
        color: "#8696a0",
        fontSize: "15px",
        fontWeight: "700",
        letterSpacing: "-4px",
        marginLeft: "4px",
        lineHeight: 1,
      }}
    >
      ✓✓
    </span>
  );
}

export default function LiveChat({ socket, theme = "donor", initialRecipient, onUnreadChange }) {
  const t = THEMES[theme] || THEMES.donor;
  const [conversations, setConversations] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeId, setActiveId] = useState(null);
  const [activeMeta, setActiveMeta] = useState(null);
  const [unreadDividerCount, setUnreadDividerCount] = useState(0);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [onlineUsers, setOnlineUsers] = useState(() => new Set());
  const [partnerLive, setPartnerLive] = useState(null);
  const [sharingLive, setSharingLive] = useState(false);
  const [locationBusy, setLocationBusy] = useState(false);
  const [hasLoadedConversations, setHasLoadedConversations] = useState(false);
  const bottomRef = useRef(null);
  const watchIdRef = useRef(null);
  const myIdRef = useRef(null);
  const searchTimerRef = useRef(null);
  const lastOpenedRef = useRef(null);
  const activeIdRef = useRef(null);

  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  const scrollToBottom = () => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  };

  const totalUnread = conversations.reduce((sum, c) => sum + (c.unreadCount || 0), 0);

  useEffect(() => {
    if (hasLoadedConversations) {
      onUnreadChange?.(totalUnread);
    }
  }, [totalUnread, onUnreadChange, hasLoadedConversations]);

  const fetchConversations = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/conversations`, authHeaders());
      setConversations(res.data);
      return res.data;
    } catch {
      setError("Could not load conversations");
      return [];
    }
  }, []);

  const runContactSearch = useCallback(async (query) => {
    const q = query.trim();
    if (!q) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await axios.get(`${API}/contacts`, {
        ...authHeaders(),
        params: { search: q },
      });
      setSearchResults(res.data);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => runContactSearch(searchQuery), 300);
    return () => clearTimeout(searchTimerRef.current);
  }, [searchQuery, runContactSearch]);

  const clearUnreadLocal = useCallback((conversationId) => {
    const key = String(conversationId);
    setConversations((prev) =>
      prev.map((c) => (String(c._id) === key ? { ...c, unreadCount: 0 } : c))
    );
  }, []);

  const markAsRead = useCallback(
    async (conversationId) => {
      if (!conversationId) return;
      try {
        await axios.put(`${API}/conversations/${conversationId}/read`, {}, authHeaders());
        clearUnreadLocal(conversationId);
        setUnreadDividerCount(0);
      } catch {
        /* silent — opening chat already marks read */
      }
    },
    [clearUnreadLocal]
  );

  const parseMessagesResponse = (data) => {
    if (Array.isArray(data)) {
      return { messages: data, unreadOnOpen: 0, partnerLive: null, myLiveShare: null };
    }
    return {
      messages: data.messages || [],
      unreadOnOpen: data.unreadOnOpen || 0,
      partnerLive: data.partnerLive || null,
      myLiveShare: data.myLiveShare || null,
    };
  };

  const stopLiveWatch = useCallback(() => {
    if (watchIdRef.current != null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }, []);

  const markLocationMessagesNotLive = useCallback((userId) => {
    if (!userId) return;
    setMessages((prev) =>
      prev.map((m) => {
        if (
          m.messageType !== "location" ||
          !m.location?.isLive ||
          String(m.senderId) !== String(userId)
        ) {
          return m;
        }
        const city = m.location.city;
        const citySuffix = city ? ` · ${city}` : "";
        return {
          ...m,
          body: `🩸 Coordinates${citySuffix}`,
          location: { ...m.location, isLive: false },
        };
      })
    );
  }, []);

  const pushLiveUpdate = useCallback(
    (conversationId, lat, lng, city) => {
      if (!socket?.connected) return;
      socket.emit("location-live-update", { conversationId, lat, lng, city });
    },
    [socket]
  );

  const startLiveWatch = useCallback(
    (conversationId) => {
      stopLiveWatch();
      if (!navigator.geolocation) return;
      watchIdRef.current = navigator.geolocation.watchPosition(
        async (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          const city = await reverseCity(lat, lng);
          pushLiveUpdate(conversationId, lat, lng, city);
        },
        () => {},
        { enableHighAccuracy: true, maximumAge: 8000, timeout: 20000 }
      );
    },
    [stopLiveWatch, pushLiveUpdate]
  );

  const stopSharingLive = useCallback(async () => {
    stopLiveWatch();
    setSharingLive(false);
    const userId = myIdRef.current;
    if (!activeId) return;
    try {
      if (socket?.connected) {
        await new Promise((resolve) => {
          socket.emit("location-live-stop", {}, () => resolve());
        });
      }
      await axios.post(
        `${API}/conversations/${activeId}/location`,
        { live: false },
        authHeaders()
      );
      markLocationMessagesNotLive(userId);
    } catch {
      /* ignore */
    }
  }, [activeId, socket, stopLiveWatch, markLocationMessagesNotLive]);

  const startLocationShare = useCallback(async () => {
    if (!activeId || sharingLive) return;
    setLocationBusy(true);
    setError("");
    try {
      const { lat, lng } = await getCurrentCoords();
      const city = await reverseCity(lat, lng);

      const res = await axios.post(
        `${API}/conversations/${activeId}/location`,
        { lat, lng, city, live: true },
        authHeaders()
      );

      if (res.data.message) {
        setMessages((prev) => {
          if (prev.some((m) => m._id === res.data.message._id)) return prev;
          return [...prev, res.data.message];
        });
        scrollToBottom();
      }

      setSharingLive(true);
      startLiveWatch(activeId);
      await fetchConversations();
    } catch (err) {
      setError(
        err.message ||
          err.response?.data?.message ||
          "Allow location access in your browser to share coordinates."
      );
    } finally {
      setLocationBusy(false);
    }
  }, [activeId, sharingLive, startLiveWatch, fetchConversations]);

  useEffect(() => {
    return () => stopLiveWatch();
  }, [stopLiveWatch]);

  const openConversation = useCallback(
    async (conversationId, meta, unreadHint = 0) => {
      setActiveId(conversationId);
      setActiveMeta(meta);
      setError("");

      try {
        const res = await axios.get(
          `${API}/conversations/${conversationId}/messages`,
          authHeaders()
        );
        const { messages: loaded, unreadOnOpen, partnerLive: pl, myLiveShare } =
          parseMessagesResponse(res.data);
        const dividerCount = unreadOnOpen || unreadHint || 0;

        setMessages(loaded);
        setUnreadDividerCount(dividerCount);
        setPartnerLive(pl);
        setSharingLive(!!myLiveShare?.active);
        if (myLiveShare?.active) startLiveWatch(conversationId);
        else stopLiveWatch();
        clearUnreadLocal(conversationId);
        scrollToBottom();
        await fetchConversations();
      } catch (err) {
        setError(err.response?.data?.message || "Failed to load messages");
      }
    },
    [fetchConversations, clearUnreadLocal, startLiveWatch, stopLiveWatch]
  );

  const startChatWith = useCallback(
    async (contact) => {
      setSearchQuery("");
      setSearchResults([]);
      setError("");
      try {
        const res = await axios.post(
          `${API}/conversations`,
          { recipientId: contact._id, requestId: contact.requestId || undefined },
          authHeaders()
        );
        const conv = res.data.conversation;
        setConversations((prev) => {
          const exists = prev.find((c) => String(c._id) === String(conv._id));
          if (exists) {
            return prev.map((c) =>
              String(c._id) === String(conv._id) ? { ...c, ...conv } : c
            );
          }
          return [conv, ...prev];
        });
        await openConversation(conv._id, conv.otherUser, 0);
      } catch (err) {
        setError(err.response?.data?.message || "Cannot start chat");
      }
    },
    [openConversation]
  );

  const applyOnlineIds = useCallback((ids) => {
    setOnlineUsers(new Set((ids || []).map(String)));
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const token = getToken();
      if (token && socket) {
        socket.emit("join", token);
      }
      try {
        const pres = await axios.get(`${API}/presence`, authHeaders());
        if (!cancelled) applyOnlineIds(pres.data.onlineUserIds);
      } catch {
        /* presence API optional fallback */
      }
      await fetchConversations();
      if (!cancelled) {
        setHasLoadedConversations(true);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchConversations, socket, applyOnlineIds]);

  useEffect(() => {
    if (!socket) return;

    const onSync = (data) => {
      applyOnlineIds(data.onlineUserIds);
    };

    const onUpdate = (data) => {
      const uid = String(data.userId);
      setOnlineUsers((prev) => {
        const next = new Set(prev);
        if (data.online) next.add(uid);
        else next.delete(uid);
        return next;
      });
    };

    socket.on("presence-sync", onSync);
    socket.on("presence-update", onUpdate);
    return () => {
      socket.off("presence-sync", onSync);
      socket.off("presence-update", onUpdate);
    };
  }, [socket, applyOnlineIds]);

  useEffect(() => {
    const id = initialRecipient?._id;
    if (!id) {
      lastOpenedRef.current = null;
      return;
    }
    if (lastOpenedRef.current === id) return;
    lastOpenedRef.current = id;
    startChatWith(initialRecipient);
  }, [initialRecipient, startChatWith]);

  useEffect(() => {
    try {
      const token = getToken();
      if (!token) return;
      myIdRef.current = JSON.parse(atob(token.split(".")[1])).userId;
    } catch {
      myIdRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!socket) return;

    const onMessage = (data) => {
      const { conversationId, message } = data;
      const convKey = String(conversationId);
      const isActive = String(activeIdRef.current) === convKey;

      setConversations((prev) => {
        const updated = prev.map((c) =>
          String(c._id) === convKey
            ? {
                ...c,
                lastMessage: message.body,
                lastMessageAt: message.createdAt,
                unreadCount: isActive ? 0 : (c.unreadCount || 0) + 1,
              }
            : c
        );
        if (!updated.some((c) => String(c._id) === convKey)) {
          fetchConversations();
          return prev;
        }
        return updated.sort(
          (a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt)
        );
      });

      if (isActive) {
        setMessages((prev) => {
          if (prev.some((m) => m._id === message._id)) return prev;
          return [...prev, { ...message, wasUnread: false }];
        });
        if (message.messageType === "location" && message.location?.isLive) {
          setPartnerLive({
            userId: message.senderId,
            lat: message.location.lat,
            lng: message.location.lng,
            city: message.location.city || "",
            updatedAt: Date.now(),
            active: true,
          });
        }
        scrollToBottom();
        markAsRead(conversationId);
      }
    };

    const onRead = (data) => {
      const convKey = String(data.conversationId);
      if (String(activeIdRef.current) !== convKey) return;
      const ids = new Set((data.messageIds || []).map(String));
      setMessages((prev) =>
        prev.map((m) => {
          if (String(m.senderId) !== String(myIdRef.current)) return m;
          if (ids.size === 0 || ids.has(String(m._id))) {
            return { ...m, readByOther: true };
          }
          return m;
        })
      );
    };

    const onLocationLive = (data) => {
      const convKey = String(data.conversationId);
      if (String(activeIdRef.current) !== convKey) return;
      if (String(data.userId) === String(myIdRef.current)) return;

      if (data.active === false) {
        setPartnerLive(null);
        markLocationMessagesNotLive(data.userId);
        return;
      }
      setPartnerLive({
        userId: data.userId,
        lat: data.lat,
        lng: data.lng,
        city: data.city || "",
        updatedAt: data.updatedAt || Date.now(),
        active: true,
      });
    };

    socket.on("chat-message", onMessage);
    socket.on("chat-read", onRead);
    socket.on("location-live", onLocationLive);
    return () => {
      socket.off("chat-message", onMessage);
      socket.off("chat-read", onRead);
      socket.off("location-live", onLocationLive);
    };
  }, [socket, fetchConversations, markAsRead, markLocationMessagesNotLive]);

  const firstUnreadIndex = useMemo(() => {
    if (unreadDividerCount <= 0) return -1;
    return messages.findIndex((m) => m.wasUnread);
  }, [messages, unreadDividerCount]);

  const filteredConversations = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) => {
      const name = c.otherUser?.name?.toLowerCase() || "";
      const role = c.otherUser?.role?.toLowerCase() || "";
      const last = c.lastMessage?.toLowerCase() || "";
      return name.includes(q) || role.includes(q) || last.includes(q);
    });
  }, [conversations, searchQuery]);

  const sendMessage = async (e) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || !activeId || sending) return;

    setSending(true);
    setInput("");
    setError("");

    const optimistic = {
      _id: `temp-${Date.now()}`,
      conversationId: activeId,
      senderId: myIdRef.current,
      body: text,
      createdAt: new Date().toISOString(),
      sender: { name: "You", role: theme },
      pending: true,
      readByOther: false,
    };
    setMessages((prev) => [...prev, optimistic]);
    scrollToBottom();

    try {
      let saved;
      if (socket?.connected) {
        saved = await new Promise((resolve, reject) => {
          socket.emit("chat-send", { conversationId: activeId, body: text }, (ack) => {
            if (ack?.ok) resolve(ack.message);
            else reject(new Error(ack?.message || "Send failed"));
          });
        });
      } else {
        const res = await axios.post(
          `${API}/conversations/${activeId}/messages`,
          { body: text },
          authHeaders()
        );
        saved = { ...res.data.message, readByOther: false };
      }
      setMessages((prev) =>
        prev.filter((m) => m._id !== optimistic._id).concat(saved)
      );
      await fetchConversations();
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m._id !== optimistic._id));
      setInput(text);
      setError(err.message || err.response?.data?.message || "Failed to send");
    } finally {
      setSending(false);
    }
  };

  const showSearchPeople = searchQuery.trim().length > 0;

  return (
    <div
      style={{
        display: "flex",
        height: "min(72vh, 640px)",
        border: "1px solid #e2e8f0",
        borderRadius: "16px",
        overflow: "hidden",
        background: "#fff",
        boxShadow: "0 8px 30px rgba(0,0,0,0.06)",
      }}
    >
      <div
        style={{
          width: "300px",
          borderRight: "1px solid #e2e8f0",
          display: "flex",
          flexDirection: "column",
          background: "#fff",
          flexShrink: 0,
        }}
      >
        <div style={{ padding: "14px 16px", borderBottom: "1px solid #e2e8f0", background: "#f0f2f5" }}>
          <div
            style={{
              fontWeight: "800",
              color: "#111b21",
              fontSize: "15px",
              marginBottom: "10px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            Chats
            {totalUnread > 0 && <UnreadBadge count={totalUnread} size={20} />}
          </div>
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search name or message..."
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: "8px",
              border: "none",
              fontSize: "13px",
              outline: "none",
              boxSizing: "border-box",
              background: "#fff",
            }}
          />
        </div>

        {showSearchPeople && (
          <div style={{ maxHeight: "160px", overflowY: "auto", borderBottom: "1px solid #e9edef" }}>
            <div style={{ padding: "8px 16px", fontSize: "12px", color: "#667781", fontWeight: "600" }}>
              Contacts
            </div>
            {searching ? (
              <p style={{ padding: "8px 16px", fontSize: "13px", color: "#667781", margin: 0 }}>Searching...</p>
            ) : searchResults.length === 0 ? (
              <p style={{ padding: "8px 16px", fontSize: "13px", color: "#667781", margin: 0 }}>No results</p>
            ) : (
              searchResults.map((c) => (
                <button
                  key={c._id}
                  type="button"
                  onClick={() => startChatWith(c)}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    padding: "10px 16px",
                    border: "none",
                    borderBottom: "1px solid #f0f2f5",
                    background: "transparent",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ fontWeight: "600", fontSize: "14px", color: "#111b21" }}>
                    {roleIcon(c.role)} {c.name}
                    {isOnline(onlineUsers, c._id) && (
                      <span style={{ color: WA_GREEN, fontSize: "11px", marginLeft: "6px" }}>● online</span>
                    )}
                  </div>
                  <div style={{ fontSize: "12px", color: "#667781" }}>{c.subtitle || c.role}</div>
                </button>
              ))
            )}
          </div>
        )}

        <div style={{ flex: 1, overflowY: "auto", background: "#fff" }}>
          {loading ? (
            <p style={{ padding: "20px", color: "#667781", fontSize: "13px" }}>Loading...</p>
          ) : filteredConversations.length === 0 ? (
            <p style={{ padding: "16px", color: "#667781", fontSize: "13px", lineHeight: 1.5, margin: 0 }}>
              {searchQuery.trim() ? "No chats match." : "Search above to start a conversation."}
            </p>
          ) : (
            filteredConversations.map((conv) => {
              const unread = conv.unreadCount || 0;
              const isActive = String(activeId) === String(conv._id);
              const otherOnline = isOnline(onlineUsers, conv.otherUser?._id);
              return (
                <button
                  key={conv._id}
                  type="button"
                  onClick={() => openConversation(conv._id, conv.otherUser, unread)}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    padding: "12px 16px",
                    border: "none",
                    borderBottom: "1px solid #f0f2f5",
                    background: isActive ? "#f0f2f5" : "#fff",
                    cursor: "pointer",
                    display: "flex",
                    gap: "12px",
                    alignItems: "center",
                  }}
                >
                  <AvatarWithPresence online={otherOnline} size={48}>
                    <div
                      style={{
                        width: "48px",
                        height: "48px",
                        borderRadius: "50%",
                        background: t.bg,
                        border: `2px solid ${unread > 0 ? WA_GREEN : "#e9edef"}`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "20px",
                      }}
                    >
                      {roleIcon(conv.otherUser?.role)}
                    </div>
                  </AvatarWithPresence>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
                      <span
                        style={{
                          fontWeight: unread > 0 ? "700" : "500",
                          fontSize: "15px",
                          color: "#111b21",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {conv.otherUser?.name}
                      </span>
                      {unread > 0 && <UnreadBadge count={unread} />}
                    </div>
                    <div
                      style={{
                        fontSize: "13px",
                        color: unread > 0 ? "#111b21" : "#667781",
                        marginTop: "2px",
                        fontWeight: unread > 0 ? "600" : "400",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {unread > 0 ? (
                        <span style={{ color: WA_GREEN }}>{formatMessageCount(unread)} · </span>
                      ) : otherOnline ? (
                        <span style={{ color: WA_GREEN }}>online · </span>
                      ) : null}
                      {conv.lastMessage || (otherOnline ? "Online now" : "Tap to chat")}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, background: "#efeae2" }}>
        {!activeId ? (
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#667781",
              padding: "24px",
              textAlign: "center",
            }}
          >
            <div>
              <div style={{ fontSize: "48px", marginBottom: "12px", opacity: 0.5 }}>💬</div>
              <p style={{ margin: 0, fontWeight: "500", color: "#41525d" }}>Select a chat</p>
              <p style={{ margin: "8px 0 0", fontSize: "13px" }}>Unread counts show like WhatsApp (1, 2, 3…)</p>
            </div>
          </div>
        ) : (
          <>
            <div
              style={{
                padding: "10px 16px",
                borderBottom: "1px solid #e9edef",
                background: "#f0f2f5",
                display: "flex",
                alignItems: "center",
                gap: "12px",
              }}
            >
              <AvatarWithPresence
                online={isOnline(onlineUsers, activeMeta?._id)}
                size={40}
              >
                <div
                  style={{
                    width: "40px",
                    height: "40px",
                    borderRadius: "50%",
                    background: t.bg,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "18px",
                  }}
                >
                  {roleIcon(activeMeta?.role)}
                </div>
              </AvatarWithPresence>
              <div>
                <div style={{ fontWeight: "600", color: "#111b21", fontSize: "15px" }}>
                  {activeMeta?.name || "Chat"}
                </div>
                <div style={{ fontSize: "12px" }}>
                  <PresenceSubtitle
                    userId={activeMeta?._id}
                    onlineUsers={onlineUsers}
                    unreadCount={unreadDividerCount}
                  />
                </div>
              </div>
            </div>

            <div
              style={{
                flex: 1,
                overflowY: "auto",
                padding: "12px 16px",
                backgroundImage:
                  "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23d9d0c3' fill-opacity='0.25'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
              }}
            >
              <PartnerTrackerCard
                share={partnerLive}
                name={activeMeta?.name || "Contact"}
                accent={t.accent}
                accentDark={t.accentDark}
              />

              {messages.map((msg, index) => {
                const isMine =
                  String(msg.senderId) === String(myIdRef.current) || msg.pending;
                const showDivider =
                  unreadDividerCount > 0 && index === firstUnreadIndex;

                const isLocation = msg.messageType === "location" && msg.location;

                return (
                  <div key={msg._id}>
                    {showDivider && <UnreadDivider count={unreadDividerCount} />}
                    <div
                      style={{
                        display: "flex",
                        justifyContent: isMine ? "flex-end" : "flex-start",
                        marginBottom: isLocation ? "12px" : "4px",
                      }}
                    >
                      {isLocation ? (
                        <div style={{ maxWidth: "88%", minWidth: "240px" }}>
                          <BloodLocationCard
                            lat={msg.location.lat}
                            lng={msg.location.lng}
                            city={msg.location.city}
                            accent={isMine ? t.accent : "#64748b"}
                            accentDark={isMine ? t.accentDark : "#475569"}
                            live={msg.location.isLive}
                          />
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "flex-end",
                              alignItems: "center",
                              gap: "4px",
                              marginTop: "4px",
                              paddingRight: "4px",
                            }}
                          >
                            <span style={{ fontSize: "11px", color: "#94a3b8" }}>
                              {new Date(msg.createdAt).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                            {isMine && (
                              <MessageTicks pending={msg.pending} readByOther={msg.readByOther} />
                            )}
                          </div>
                        </div>
                      ) : (
                        <div
                          style={{
                            maxWidth: "75%",
                            padding: "8px 12px",
                            borderRadius: isMine ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                            background: isMine ? `${t.accent}18` : "#fff",
                            border: isMine ? `1px solid ${t.accent}33` : "1px solid #e2e8f0",
                            color: "#1e293b",
                            fontSize: "14px",
                            lineHeight: 1.45,
                            opacity: msg.pending ? 0.75 : 1,
                          }}
                        >
                          {msg.body}
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "flex-end",
                              alignItems: "center",
                              gap: "2px",
                              marginTop: "4px",
                            }}
                          >
                            <span style={{ fontSize: "11px", color: "#94a3b8" }}>
                              {new Date(msg.createdAt).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                            {isMine && (
                              <MessageTicks pending={msg.pending} readByOther={msg.readByOther} />
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>

            {error && (
              <div style={{ padding: "8px 16px", background: "#fee2e2", color: "#b91c1c", fontSize: "13px" }}>
                {error}
              </div>
            )}

            <form
              onSubmit={sendMessage}
              style={{
                padding: "10px 16px",
                background: "#f0f2f5",
                display: "flex",
                gap: "8px",
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              {sharingLive ? (
                <button
                  type="button"
                  onClick={stopSharingLive}
                  style={{
                    padding: "12px 18px",
                    borderRadius: "12px",
                    border: `2px solid ${t.accent}`,
                    background: "#fff",
                    color: t.accent,
                    fontWeight: "800",
                    fontSize: "13px",
                    cursor: "pointer",
                    flexShrink: 0,
                    letterSpacing: "0.3px",
                  }}
                >
                  ■ Stop location
                </button>
              ) : (
                <button
                  type="button"
                  disabled={locationBusy}
                  onClick={startLocationShare}
                  title="Send your live location"
                  style={{
                    padding: "12px 16px",
                    borderRadius: "12px",
                    border: "none",
                    background: `linear-gradient(135deg, ${t.accent}, ${t.accentDark})`,
                    color: "#fff",
                    fontWeight: "800",
                    fontSize: "13px",
                    cursor: locationBusy ? "wait" : "pointer",
                    flexShrink: 0,
                    opacity: locationBusy ? 0.7 : 1,
                    boxShadow: `0 4px 12px ${t.accent}44`,
                  }}
                >
                  {locationBusy ? "…" : "📍 Location"}
                </button>
              )}
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type a message"
                maxLength={2000}
                style={{
                  flex: 1,
                  padding: "12px 16px",
                  borderRadius: "24px",
                  border: "none",
                  fontSize: "15px",
                  outline: "none",
                  background: "#fff",
                }}
              />
              <button
                type="submit"
                disabled={sending || !input.trim()}
                style={{
                  width: "48px",
                  height: "48px",
                  borderRadius: "50%",
                  border: "none",
                  background: sending || !input.trim() ? "#94a3b8" : t.accent,
                  color: "#fff",
                  fontWeight: "700",
                  fontSize: "18px",
                  cursor: sending || !input.trim() ? "not-allowed" : "pointer",
                  flexShrink: 0,
                }}
                aria-label="Send"
              >
                ➤
              </button>
            </form>
          </>
        )}
      </div>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.45; transform: scale(0.85); }
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}
