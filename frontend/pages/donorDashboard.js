import axios from "axios";
import { useRouter } from "next/router";
import { useEffect, useState, useRef } from "react";
import { io } from "socket.io-client";
import LiveChat from "../components/LiveChat";

let socket = null;

// Helper to calculate distance in Km
function getDistanceKm(lat1, lng1, lat2, lng2) {
  if (!lat1 || !lng1 || !lat2 || !lng2) return null;
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Helper to calculate time left
function getRemainingTime(expiresAt) {
  const diff = new Date(expiresAt) - new Date();
  if (diff <= 0) return "Expired";
  const mins = Math.floor(diff / 60000);
  const secs = Math.floor((diff % 60000) / 1000);
  return `${mins}m ${secs}s`;
}

// Colors for urgency levels
const urgencyStyles = {
  critical: { bg: "#fee2e2", border: "#fca5a5", color: "#991b1b", text: "CRITICAL" },
  urgent: { bg: "#ffedd5", border: "#fed7aa", color: "#c2410c", text: "URGENT" },
  normal: { bg: "#f0fdf4", border: "#bbf7d0", color: "#166534", text: "NORMAL" },
};

// Colors for report statuses
const reportStatusColors = {
  pending: { bg: "#fffbeb", border: "#fde68a", color: "#b45309" },
  resolved: { bg: "#f0fdf4", border: "#bbf7d0", color: "#166534" },
  dismissed: { bg: "#f8fafc", border: "#e2e8f0", color: "#475569" },
};

// Preset cartoon avatars
const AVATAR_PRESETS = [
  { emoji: "🦸‍♂️", label: "Hero Lifesaver" },
  { emoji: "❤️", label: "Heart Beat" },
  { emoji: "🩺", label: "Health Guard" },
  { emoji: "🧬", label: "Life Line" },
  { emoji: "🩹", label: "First Responder" },
  { emoji: "✨", label: "Hope Giver" }
];

export default function DonorDashboard() {
  const router = useRouter();
  const [requests, setRequests] = useState([]);
  const [cooldownMsg, setCooldownMsg] = useState("");
  const [availability, setAvailability] = useState("available");
  const [userProfile, setUserProfile] = useState(null);
  const [activeTab, setActiveTab] = useState("requests");
  // Donor stats from /api/user/eligibility
  const [donorStats, setDonorStats] = useState(null);

  // Filters
  const [proximityFilter, setProximityFilter] = useState("all");
  const [urgencyFilter, setUrgencyFilter] = useState("all");

  // Report modal
  const [reportTarget, setReportTarget] = useState(null);
  const [reportReason, setReportReason] = useState("");

  // My Reports
  const [myReports, setMyReports] = useState([]);
  const [reportsLoading, setReportsLoading] = useState(false);

  // Notifications
  const [notification, setNotification] = useState(null);

  // Live chat
  const [chatRecipient, setChatRecipient] = useState(null);
  const [messageUnread, setMessageUnread] = useState(0);
  const [tick, setTick] = useState(0);

  const getStatusColor = (status) => {
    const s = status || availability;
    if (s === "available") return "#10b981";
    if (s === "busy") return "#f59e0b";
    return "#64748b";
  };

  const fetchProfile = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        router.push("/login");
        return;
      }
      const res = await axios.get("http://localhost:5000/api/user/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setAvailability(res.data.availability);
      setUserProfile(res.data);
    } catch (err) {
      console.error("Error fetching profile", err);
    }
  };

  const fetchDonorStats = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get("http://localhost:5000/api/user/eligibility", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setDonorStats(res.data);
    } catch (err) {
      console.error("Error fetching donor stats", err);
    }
  };

  const fetchMyReports = async () => {
    setReportsLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get("http://localhost:5000/api/user/my-reports", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setMyReports(res.data);
    } catch (err) {
      console.error("Failed to load reports", err);
    } finally {
      setReportsLoading(false);
    }
  };

  const handleDeleteReport = async (id) => {
    if (!confirm("Are you sure you want to remove this report record?")) return;
    try {
      const token = localStorage.getItem("token");
      await axios.delete(`http://localhost:5000/api/user/reports/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchMyReports();
    } catch (err) {
      alert("Failed to remove report");
    }
  };

  const updateAvailabilityState = async (newStatus) => {
    try {
      const token = localStorage.getItem("token");
      const res = await axios.put(
        "http://localhost:5000/api/user/availability",
        { availability: newStatus },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setAvailability(res.data.availability);
      fetchRequests(); // Refresh requests immediately based on new availability
    } catch (err) {
      alert("Failed to update availability");
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    window.location.href = "/login";
  };

  const handleReportSubmit = async (e) => {
    e.preventDefault();
    if (!reportReason.trim()) return;
    try {
      const token = localStorage.getItem("token");
      await axios.post(
        "http://localhost:5000/api/user/report",
        {
          targetId: reportTarget.hospitalId,
          reason: reportReason,
          requestId: reportTarget.requestId,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert("✅ Report submitted! The admin will review it and you'll be notified here.");
      setReportTarget(null);
      setReportReason("");
      if (activeTab === "reports") fetchMyReports();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to submit report");
    }
  };

  const fetchRequests = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get("http://localhost:5000/api/requests", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setRequests(res.data.requests);
      if (res.data.eligibility) {
        if (!res.data.eligibility.eligible) {
          setCooldownMsg(`Blocked: wait ${res.data.eligibility.remainingDays} days`);
        } else {
          setCooldownMsg("");
        }
      }
    } catch (err) {
      console.error("Error fetching requests", err);
    }
  };

  const acceptRequest = async (id) => {
    if (availability === "offline") return alert("You must be ONLINE to accept");
    try {
      const token = localStorage.getItem("token");
      await axios.post(`http://localhost:5000/api/requests/accept/${id}`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      alert("🎉 Accept Successful! You have committed to this donation.");
      fetchRequests();
      fetchProfile();
    } catch (err) {
      setCooldownMsg(err.response?.data?.message || "Not eligible");
    }
  };

  const declineRequest = async (id) => {
    try {
      const token = localStorage.getItem("token");
      await axios.post(`http://localhost:5000/api/requests/decline/${id}`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      alert("✅ Decline successful");
      fetchRequests();
      fetchProfile();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to decline request");
    }
  };

  const getEligibilityInfo = () => {
    if (!userProfile?.lastDonationDate) {
      return { eligible: true, text: "Eligible to Donate" };
    }
    const daysSinceLastDonation = Math.floor(
      (new Date() - new Date(userProfile.lastDonationDate)) / (1000 * 60 * 60 * 24)
    );
    const remainingDays = 90 - daysSinceLastDonation;
    if (remainingDays <= 0) {
      return { eligible: true, text: "Eligible to Donate" };
    }
    return { eligible: false, text: `Can Donate After ${remainingDays} Days` };
  };

  // Sync active tabs from URL parameters
  useEffect(() => {
    if (router.query?.tab) {
      setActiveTab(router.query.tab);
    }
  }, [router.query]);

  // Socket setup
  useEffect(() => {
    if (typeof window === "undefined") return;
    
    const token = localStorage.getItem("token");
    if (!token) return;
    
    if (!socket) {
      socket = io("http://localhost:5000");
    }
    
    socket.emit("join", token);

    fetchRequests();
    fetchProfile();
    fetchDonorStats();

    socket.on("new-request", (data) => {
      setRequests((prev) => {
        if (prev.find((r) => r._id === data._id)) return prev;
        return [data, ...prev];
      });
    });

    socket.on("report-resolved", (data) => {
      const isResolved = data.status === "resolved";
      setNotification({
        type: isResolved ? "success" : "info",
        message: isResolved
          ? `✅ Your report about ${data.targetName} (${data.targetRole}) has been RESOLVED by admin.`
          : `ℹ️ Your report about ${data.targetName} was reviewed and dismissed by admin.`,
        notes: data.adminNotes,
      });

      fetchMyReports();
      setTimeout(() => setNotification(null), 10000);
    });

    socket.on("request-cancelled", (data) => {
      setNotification({
        type: "info",
        message: `🚫 A blood request you committed to has been cancelled by the hospital.`,
      });
      fetchRequests();
      setTimeout(() => setNotification(null), 10000);
    });

    return () => {
      socket.off("new-request");
      socket.off("report-resolved");
      socket.off("request-cancelled");
    };
  }, []);

  // Tick for timers
  useEffect(() => {
    const interval = setInterval(() => setTick((p) => p + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (activeTab === "reports") fetchMyReports();
  }, [activeTab]);

  // Request filters logic
  const filteredRequests = requests.filter((req) => {
    // 1. Urgency check
    if (urgencyFilter !== "all" && req.urgency !== urgencyFilter) return false;

    // 2. Proximity check
    if (proximityFilter !== "all" && userProfile?.location) {
      const donorLat = userProfile.location.lat;
      const donorLng = userProfile.location.lng;
      
      if (!donorLat || !donorLng) return true;
      
      const distance = getDistanceKm(donorLat, donorLng, req.location?.lat, req.location?.lng);
      
      if (proximityFilter === "5km" && (distance === null || distance > 5)) return false;
      if (proximityFilter === "15km" && (distance === null || distance > 15)) return false;
      if (proximityFilter === "city") {
        const donorCity = userProfile.location.city?.toLowerCase() || "";
        const reqCity = req.location?.city?.toLowerCase() || "";
        if (donorCity !== reqCity) return false;
      }
    }
    return true;
  });

  if (!userProfile) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", justifyContent: "center", alignItems: "center", background: "#f8fafc", fontFamily: "'Inter', sans-serif" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
          <div style={{ width: "40px", height: "40px", border: "4px solid #cbd5e1", borderTop: "4px solid #e63946", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
          <span style={{ color: "#64748b", fontWeight: "600", fontSize: "15px" }}>Syncing profile...</span>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const isLocationMissing = !userProfile.location?.lat || !userProfile.location?.lng;
  const eligibilityInfo = getEligibilityInfo();

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f0f2f5", fontFamily: "'Inter', system-ui, sans-serif", color: "#334155" }}>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet" />

      {/* LIVE NOTIFICATION BANNER */}
      {notification && (
        <div style={{
          position: "fixed", top: "80px", left: "50%", transform: "translateX(-50%)",
          zIndex: 9999, maxWidth: "520px", width: "90%",
          backgroundColor: notification.type === "success" ? "#f0fdf4" : "#eff6ff",
          border: `1.5px solid ${notification.type === "success" ? "#86efac" : "#93c5fd"}`,
          borderRadius: "12px", padding: "16px 20px",
          boxShadow: "0 8px 30px rgba(0,0,0,0.12)",
          animation: "slideDown 0.3s ease",
        }}>
          <p style={{ margin: "0 0 6px 0", fontWeight: "bold", fontSize: "15px", color: notification.type === "success" ? "#15803d" : "#1d4ed8" }}>
            {notification.message}
          </p>
          {notification.notes && (
            <p style={{ margin: 0, fontSize: "13px", color: "#475569", fontStyle: "italic" }}>
              Admin Note: "{notification.notes}"
            </p>
          )}
          <button onClick={() => setNotification(null)} style={{ position: "absolute", top: "10px", right: "12px", background: "none", border: "none", cursor: "pointer", fontSize: "16px", color: "#94a3b8" }}>✕</button>
        </div>
      )}

        {/* 🔝 NAVBAR */}
        <nav style={{ backgroundColor: "white", padding: "15px 30px", boxShadow: "0 2px 10px rgba(0,0,0,0.1)", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, zIndex: 100 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
            <h2 style={{ margin: 0, color: "#e63946", display: "flex", alignItems: "center", gap: "8px" }}>
              🩸 Donor Dashboard
            </h2>
          </div>

          <div style={{ display: "flex", gap: "25px", alignItems: "center" }}>
            <span onClick={() => setActiveTab("requests")} style={{ cursor: "pointer", fontSize: "14px", fontWeight: activeTab === "requests" ? "bold" : "600", color: activeTab === "requests" ? "#e63946" : "#555", borderBottom: activeTab === "requests" ? "2px solid #e63946" : "none", paddingBottom: "5px" }}>
              Emergency Feed
            </span>
            <span onClick={() => { setActiveTab("messages"); setChatRecipient(null); }} style={{ cursor: "pointer", fontSize: "14px", fontWeight: activeTab === "messages" ? "bold" : "600", color: activeTab === "messages" ? "#e63946" : "#555", borderBottom: activeTab === "messages" ? "2px solid #e63946" : "none", paddingBottom: "5px" }}>
              💬 Messages{messageUnread > 0 ? ` (${messageUnread})` : ""}
            </span>
            <span onClick={() => router.push("/history")} style={{ cursor: "pointer", fontSize: "14px", fontWeight: "600", color: "#555", paddingBottom: "5px" }}>
              Donation History
            </span>
            <span onClick={() => setActiveTab("reports")} style={{ cursor: "pointer", fontSize: "14px", fontWeight: activeTab === "reports" ? "bold" : "600", color: activeTab === "reports" ? "#e63946" : "#555", borderBottom: activeTab === "reports" ? "2px solid #e63946" : "none", paddingBottom: "5px" }}>
              My Reports {myReports.filter(r => r.status === "pending").length > 0 && activeTab !== "reports" ? "🔴" : ""}
            </span>
            <span onClick={() => router.push("/profile")} style={{ cursor: "pointer", fontSize: "14px", fontWeight: "600", color: "#555", paddingBottom: "5px" }}>
              Profile
            </span>

            {/* NAVBAR PROFILE PHOTO & LOGOUT */}
            {userProfile && (
              <div style={{ display: "flex", alignItems: "center", gap: "15px", borderLeft: "2px solid #eee", paddingLeft: "20px" }}>
                {/* Availability Selector (Premium Industry-Level Segmented Control) */}
                <div style={{ display: "flex", borderRadius: "30px", background: "#f1f5f9", padding: "4px", gap: "4px", border: "1px solid #e2e8f0", alignItems: "center" }}>
                  {["available", "busy", "offline"].map((statusOption) => {
                    const active = availability === statusOption;
                    const dotColor = statusOption === "available" ? "#10b981" : statusOption === "busy" ? "#f59e0b" : "#64748b";
                    const activeBg = statusOption === "available" ? "#10b981" : statusOption === "busy" ? "#f59e0b" : "#64748b";
                    
                    return (
                      <button
                        key={statusOption}
                        onClick={() => updateAvailabilityState(statusOption)}
                        style={{
                          border: "none",
                          borderRadius: "20px",
                          padding: "6px 14px",
                          fontSize: "12px",
                          fontWeight: "700",
                          cursor: "pointer",
                          textTransform: "capitalize",
                          transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
                          backgroundColor: active ? activeBg : "transparent",
                          color: active ? "#ffffff" : "#64748b",
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                          boxShadow: active ? "0 2px 8px rgba(0,0,0,0.12)" : "none"
                        }}
                      >
                        <span style={{
                          width: "6px",
                          height: "6px",
                          borderRadius: "50%",
                          backgroundColor: active ? "#ffffff" : dotColor,
                          transition: "background-color 0.25s"
                        }} />
                        {statusOption}
                      </button>
                    );
                  })}
                </div>
                {userProfile.profilePhoto ? (
                  AVATAR_PRESETS.find(p => p.emoji === userProfile.profilePhoto) ? (
                    <span style={{ fontSize: "24px" }}>{userProfile.profilePhoto}</span>
                  ) : (
                    <img src={userProfile.profilePhoto} alt="Nav" style={{ height: "36px", width: "36px", borderRadius: "50%", objectFit: "cover", border: "2px solid #ddd" }} />
                  )
                ) : (
                  <div style={{ height: "36px", width: "36px", backgroundColor: "#e63946", color: "white", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px", fontWeight: "bold", border: "2px solid #eee" }}>
                    {(userProfile.name || "").charAt(0).toUpperCase()}
                  </div>
                )}
                <button
                  onClick={handleLogout}
                  style={{ backgroundColor: "#ef4444", color: "white", border: "none", padding: "8px 15px", borderRadius: "6px", cursor: "pointer", fontWeight: "bold", boxShadow: "0 2px 4px rgba(0,0,0,0.1)" }}
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        </nav>

        {/* CONTENT AREA */}
        <div style={{ maxWidth: "1200px", margin: "30px auto", padding: "0 20px" }}>

        {/* COOLDOWN ALERTS AND WARNINGS */}
        {cooldownMsg && donorStats && !donorStats.canDonate && (
          <div style={{
            backgroundColor: "#fffbeb", border: "1px solid #fde68a", color: "#b45309",
            padding: "16px 20px", borderRadius: "14px", fontWeight: "600",
            marginBottom: "28px", display: "flex", alignItems: "center", gap: "12px",
            fontSize: "14px"
          }}>
            <span style={{ fontSize: "20px" }}>⏳</span>
            <div>
              <strong>Donation Cooldown Active:</strong> Your last donation was within 90 days. You will become eligible again in <b>{donorStats.remainingDays} days</b>.
            </div>
          </div>
        )}

        {isLocationMissing && activeTab === "requests" && (
          <div style={{
            backgroundColor: "#eff6ff", border: "1px solid #bfdbfe", color: "#1d4ed8",
            padding: "16px 20px", borderRadius: "14px", fontWeight: "600",
            marginBottom: "28px", display: "flex", alignItems: "center", gap: "12px",
            fontSize: "14px"
          }}>
            <span style={{ fontSize: "20px" }}>📍</span>
            <div style={{ flex: 1 }}>
              <strong>Coordinates Missing:</strong> Enable Auto-Detection in <b>Profile Settings</b> to calculate hospital distances and receive precise localized requests.
            </div>
            <button
              onClick={() => router.push("/profile")}
              style={{
                backgroundColor: "#2563eb", color: "#fff", border: "none",
                padding: "8px 14px", borderRadius: "8px", fontSize: "12px",
                fontWeight: "700", cursor: "pointer", boxShadow: "0 2px 8px rgba(37,99,235,0.2)"
              }}
            >
              Configure Location
            </button>
          </div>
        )}

        {/* ── REQUESTS TAB ── */}
        {activeTab === "requests" && (
          <div>

            {/* Filter Bar */}
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              marginBottom: "24px", flexWrap: "wrap", gap: "12px"
            }}>
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <span style={{ fontSize: "12px", fontWeight: "800", color: "#64748b", textTransform: "uppercase" }}>
                  Urgency:
                </span>
                {["all", "critical", "urgent", "normal"].map((opt) => (
                  <button
                    key={opt}
                    onClick={() => setUrgencyFilter(opt)}
                    style={{
                      border: "1px solid #cbd5e1", borderRadius: "8px",
                      padding: "6px 14px", fontSize: "12px", fontWeight: "700",
                      cursor: "pointer", textTransform: "capitalize", transition: "all 0.2s",
                      backgroundColor: urgencyFilter === opt ? "#0f172a" : "#ffffff",
                      color: urgencyFilter === opt ? "#ffffff" : "#475569"
                    }}
                  >
                    {opt === "all" ? "Show All" : opt}
                  </button>
                ))}
              </div>
            </div>

            {availability === "offline" ? (
              <div style={{
                textAlign: "center", padding: "80px 40px", backgroundColor: "#ffffff",
                borderRadius: "20px", border: "1px dashed #cbd5e1", color: "#64748b",
                boxShadow: "0 4px 20px rgba(0,0,0,0.01)"
              }}>
                <span style={{ fontSize: "52px", display: "block", marginBottom: "16px" }}>⚫</span>
                <h3 style={{ margin: "0 0 6px 0", color: "#0f172a", fontSize: "18px", fontWeight: "800" }}>
                  You are Offline
                </h3>
                <p style={{ margin: 0, fontSize: "14px", maxWidth: "420px", marginLeft: "auto", marginRight: "auto" }}>
                  While offline, you won't receive emergency broadcasts. Switch your status to <b>Available</b> or <b>Busy</b> in the sidebar to view active cases.
                </p>
              </div>
            ) : filteredRequests.length === 0 ? (
              <div style={{
                textAlign: "center", padding: "80px 40px", backgroundColor: "#ffffff",
                borderRadius: "20px", border: "1px dashed #cbd5e1", color: "#64748b",
                boxShadow: "0 4px 20px rgba(0,0,0,0.01)"
              }}>
                <span style={{ fontSize: "52px", display: "block", marginBottom: "16px" }}>🕊️</span>
                <h3 style={{ margin: "0 0 6px 0", color: "#0f172a", fontSize: "18px", fontWeight: "800" }}>
                  No Compatible Emergency Requests
                </h3>
                <p style={{ margin: 0, fontSize: "14px", maxWidth: "420px", marginLeft: "auto", marginRight: "auto" }}>
                  {availability === "busy" ? 
                    "You are currently marked as Busy. In this state, only Critical and Urgent broadcasts are displayed." :
                    "We couldn't find active blood requests matchable with your location and blood type right now."
                  }
                </p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
                {filteredRequests.map((req) => {
                  const accepted = req.acceptedDonors?.length || 0;
                  const remaining = req.units - accepted;
                  const styleScheme = urgencyStyles[req.urgency] || urgencyStyles.normal;
                  
                  const distance = getDistanceKm(
                    userProfile.location?.lat,
                    userProfile.location?.lng,
                    req.location?.lat,
                    req.location?.lng
                  );

                  return (
                    <div
                      key={req._id}
                      style={{
                        backgroundColor: "#ffffff", border: "1px solid #e2e8f0",
                        borderRadius: "20px", padding: "24px",
                        boxShadow: "0 8px 30px rgba(0,0,0,0.02)",
                        borderLeft: `6px solid ${styleScheme.color}`,
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                        transition: "transform 0.2s, box-shadow 0.2s",
                        position: "relative"
                      }}
                      className="request-card"
                    >
                      <div style={{ flex: 1, paddingRight: "20px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px", flexWrap: "wrap" }}>
                          <span style={{
                            backgroundColor: styleScheme.bg, color: styleScheme.color,
                            border: `1.5px solid ${styleScheme.border}`,
                            padding: "3px 12px", borderRadius: "20px", fontSize: "10px",
                            fontWeight: "800", letterSpacing: "0.5px"
                          }}>
                            {styleScheme.text} URGENCY
                          </span>
                          
                          <span style={{ color: "#64748b", fontSize: "12px", fontWeight: "600" }}>
                            ⏰ {req.broadcastStatus === "stopped" ? "📡 Broadcast Stopped" : `Timer: ${getRemainingTime(req.expiresAt)}`}
                          </span>
                        </div>

                        <h3 style={{ margin: "0 0 6px 0", fontSize: "18px", color: "#0f172a", fontWeight: "800" }}>
                          🏥 {req.hospitalId?.name || "Emergency Hospital"}
                        </h3>

                        <div style={{ display: "flex", gap: "20px", flexWrap: "wrap", fontSize: "13px", color: "#475569", marginBottom: "16px" }}>
                          <span>
                            🧬 Blood Match: <b style={{ color: "#ef4444", fontSize: "15px", fontWeight: "800" }}>{req.bloodGroup}</b>
                          </span>
                          <span>
                            📍 {req.location?.city || "Unknown City"} 
                            {distance !== null && ` • ${distance.toFixed(1)} km away`}
                          </span>
                          <span>
                            🩸 Needed: <b>{req.units} units</b>
                          </span>
                          <span>
                            🤝 Accepted: <b>{accepted}/{req.units}</b>
                          </span>
                        </div>

                        <div style={{ display: "flex", gap: "10px" }}>
                          {req.hospitalId && (
                            <>
                              <button
                                onClick={() => {
                                  setActiveTab("messages");
                                  setChatRecipient({
                                    _id: req.hospitalId._id,
                                    name: req.hospitalId.name,
                                    role: "hospital",
                                    requestId: req._id,
                                  });
                                }}
                                style={{
                                  backgroundColor: "#eff6ff", color: "#2563eb",
                                  border: "1px solid #cbd5e1", borderRadius: "10px",
                                  padding: "8px 14px", fontSize: "12px", fontWeight: "700",
                                  cursor: "pointer", display: "flex", alignItems: "center", gap: "6px"
                                }}
                              >
                                💬 Contact Hospital
                              </button>
                              {req.acceptedDonors && userProfile && req.acceptedDonors.includes(userProfile._id) && (
                                <button
                                  onClick={() => declineRequest(req._id)}
                                  style={{
                                    backgroundColor: "#fff5f5", color: "#e11d48",
                                    border: "1px solid #fca5a5", borderRadius: "10px",
                                    padding: "8px 14px", fontSize: "12px", fontWeight: "700",
                                    cursor: "pointer"
                                  }}
                                >
                                  ❌ Decline
                                </button>
                              )}

                              <button
                                onClick={() => setReportTarget({ hospitalId: req.hospitalId._id, hospitalName: req.hospitalId.name, requestId: req._id })}
                                style={{
                                  backgroundColor: "#fff5f5", color: "#ef4444",
                                  border: "1px solid #fee2e2", borderRadius: "10px",
                                  padding: "8px 14px", fontSize: "12px", fontWeight: "700",
                                  cursor: "pointer"
                                }}
                              >
                                🚨 Report Hospital
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      <div style={{ flexShrink: 0 }}>
                        {remaining <= 0 ? (
                          <span style={{ color: "#10b981", fontWeight: "800", fontSize: "14px", background: "#ecfdf5", padding: "10px 20px", borderRadius: "12px", border: "1px solid #a7f3d0" }}>
                            Fulfilled
                          </span>
                        ) : (
                          <button
                            onClick={() => acceptRequest(req._id)}
                            disabled={availability === "offline" || !eligibilityInfo.eligible}
                            style={{
                              backgroundColor: (availability !== "offline" && eligibilityInfo.eligible) ? "#e63946" : "#cbd5e1",
                              color: "white", padding: "14px 28px", border: "none", borderRadius: "12px",
                              fontWeight: "800", cursor: (availability !== "offline" && eligibilityInfo.eligible) ? "pointer" : "not-allowed",
                              fontSize: "14px", boxShadow: (availability !== "offline" && eligibilityInfo.eligible) ? "0 4px 14px rgba(230,57,70,0.25)" : "none",
                              transition: "all 0.2s"
                            }}
                          >
                            {eligibilityInfo.eligible ? "Commit Donation" : "In Cooldown"}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── MESSAGES TAB ── */}
        {activeTab === "messages" && (
          <div style={{ backgroundColor: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "20px", padding: "28px", boxShadow: "0 8px 30px rgba(0,0,0,0.02)" }}>
            <p style={{ color: "#64748b", fontSize: "14px", marginBottom: "20px", fontWeight: "500" }}>
              Message hospitals to coordinate scheduling, logistics, and get donation center updates.
            </p>
            <LiveChat
              socket={socket}
              theme="donor"
              initialRecipient={chatRecipient}
              onUnreadChange={setMessageUnread}
            />
          </div>
        )}

        {/* ── MY REPORTS TAB ── */}
        {activeTab === "reports" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "14px", color: "#64748b", fontWeight: "500" }}>
                Keep track of your safety reports against suspicious hospitals.
              </span>
              <button
                onClick={fetchMyReports}
                style={{
                  padding: "8px 16px", borderRadius: "10px", border: "1px solid #cbd5e1",
                  background: "#ffffff", cursor: "pointer", fontWeight: "700", color: "#475569",
                  fontSize: "12px"
                }}
              >
                🔄 Refresh Logs
              </button>
            </div>

            {reportsLoading ? (
              <div style={{ textAlign: "center", padding: "40px", color: "#888" }}>
                Loading report records...
              </div>
            ) : myReports.length === 0 ? (
              <div style={{
                textAlign: "center", padding: "64px 40px", backgroundColor: "#ffffff",
                borderRadius: "20px", border: "1px dashed #cbd5e1", color: "#64748b"
              }}>
                <span style={{ fontSize: "48px", display: "block", marginBottom: "12px" }}>📭</span>
                <h3 style={{ margin: "0 0 4px 0", color: "#0f172a", fontWeight: "800" }}>No Submitted Reports</h3>
                <p style={{ margin: 0, fontSize: "13px" }}>You have a clean log. Use the 'Report Hospital' option on requests if you suspect fake emergency broadcasts.</p>
              </div>
            ) : (
              myReports.map((report) => {
                const colors = reportStatusColors[report.status] || reportStatusColors.pending;
                return (
                  <div
                    key={report._id}
                    style={{
                      backgroundColor: "#ffffff", border: `1.5px solid ${colors.border}`,
                      borderRadius: "18px", padding: "20px 24px",
                      boxShadow: "0 4px 16px rgba(0,0,0,0.01)"
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px", flexWrap: "wrap" }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px", flexWrap: "wrap" }}>
                          <span style={{
                            backgroundColor: colors.bg, color: colors.color, border: `1px solid ${colors.border}`,
                            padding: "3px 12px", borderRadius: "20px", fontSize: "10px", fontWeight: "800",
                            letterSpacing: "0.5px"
                          }}>
                            {report.status.toUpperCase()}
                          </span>
                          <span style={{ color: "#94a3b8", fontSize: "12px", fontWeight: "500" }}>
                            Reported Date: {new Date(report.createdAt).toLocaleDateString()}
                          </span>
                        </div>

                        <p style={{ margin: "0 0 14px 0", color: "#0f172a", fontSize: "15px", fontWeight: "700" }}>
                          💬 "{report.reason}"
                        </p>

                        <div style={{ display: "flex", gap: "24px", flexWrap: "wrap", fontSize: "13px" }}>
                          <div>
                            <span style={{ display: "block", fontSize: "10px", fontWeight: "800", color: "#94a3b8", textTransform: "uppercase" }}>Reported Hospital</span>
                            <span style={{ fontWeight: "700", color: "#334155" }}>
                              🏥 {report.targetId?.name || "Unknown Hospital"} 
                            </span>
                            <span style={{ color: "#64748b", marginLeft: "6px" }}>({report.targetId?.email || "No Email"})</span>
                          </div>
                        </div>

                        {report.status === "pending" && (
                          <div style={{ marginTop: "14px", backgroundColor: "#fffbeb", border: "1px solid #fde68a", borderRadius: "8px", padding: "10px 14px", fontSize: "12px", color: "#92400e" }}>
                            ⏳ <b>Pending Admin Review</b> — A HemoLink administrator is reviewing the reported hospital credentials.
                          </div>
                        )}

                        {report.status === "resolved" && (
                          <div style={{ marginTop: "14px", backgroundColor: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "8px", padding: "10px 14px", fontSize: "12px", color: "#166534" }}>
                            ✅ <b>Resolved</b> — Action has been taken.
                            {report.adminNotes && <p style={{ margin: "4px 0 0 0", fontStyle: "italic" }}>Admin Note: "{report.adminNotes}"</p>}
                          </div>
                        )}

                        {report.status === "dismissed" && (
                          <div style={{ marginTop: "14px", backgroundColor: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "10px 14px", fontSize: "12px", color: "#475569" }}>
                            ℹ️ <b>Dismissed</b> — Evaluated and cleared of suspicious flags.
                            {report.adminNotes && <p style={{ margin: "4px 0 0 0", fontStyle: "italic" }}>Admin Note: "{report.adminNotes}"</p>}
                          </div>
                        )}
                      </div>

                      {report.status !== "pending" && (
                        <button
                          onClick={() => handleDeleteReport(report._id)}
                          style={{
                            background: "none", border: "none", color: "#ef4444",
                            cursor: "pointer", fontSize: "12px", fontWeight: "700",
                            textDecoration: "underline"
                          }}
                        >
                          Clear Log Record
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        </div>

      {/* REPORT SUSPICIOUS HOSPITAL MODAL */}
      {reportTarget && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(15,23,42,0.4)", backdropFilter: "blur(4px)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 10000 }}>
          <div style={{ backgroundColor: "#ffffff", padding: "32px", borderRadius: "20px", width: "90%", maxWidth: "440px", boxShadow: "0 20px 50px rgba(15,23,42,0.15)", border: "1px solid #e2e8f0" }}>
            <h3 style={{ margin: "0 0 8px 0", color: "#ef4444", fontSize: "20px", fontWeight: "800", display: "flex", alignItems: "center", gap: "8px" }}>
              🚨 Report Suspicious Hospital
            </h3>
            
            <p style={{ margin: "0 0 16px 0", fontSize: "14px", color: "#475569", lineHeight: 1.5 }}>
              You are submitting a safety report against <b>{reportTarget.hospitalName}</b>.
            </p>

            <div style={{ backgroundColor: "#f8fafc", border: "1.5px dashed #cbd5e1", borderRadius: "12px", padding: "12px 16px", marginBottom: "20px", fontSize: "12px", color: "#64748b" }}>
              🛡️ **Safety Check:** Provide precise reasons (e.g. asking for payments, fake request, unreachable location) so administrators can perform rapid profile audits.
            </div>

            <form onSubmit={handleReportSubmit} style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
              <textarea
                placeholder="Explain the issue details clearly..."
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                style={{
                  width: "100%", height: "100px", padding: "12px 14px",
                  borderRadius: "10px", border: "1.5px solid #cbd5e1",
                  outline: "none", resize: "none", fontFamily: "inherit",
                  fontSize: "14px", boxSizing: "border-box"
                }}
                required
              />
              
              <div style={{ display: "flex", gap: "10px" }}>
                <button
                  type="button"
                  onClick={() => { setReportTarget(null); setReportReason(""); }}
                  style={{
                    flex: 1, padding: "12px", backgroundColor: "#f1f5f9",
                    color: "#475569", border: "none", borderRadius: "10px",
                    cursor: "pointer", fontWeight: "700", fontSize: "13px"
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    flex: 1, padding: "12px", backgroundColor: "#ef4444",
                    color: "#ffffff", border: "none", borderRadius: "10px",
                    cursor: "pointer", fontWeight: "700", fontSize: "13px",
                    boxShadow: "0 4px 12px rgba(239,68,68,0.2)"
                  }}
                >
                  Submit Audit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Global CSS / Animations */}
      <style jsx global>{`
        body {
          margin: 0;
          padding: 0;
          background-color: #f8fafc;
        }
        @keyframes ping {
          75%, 100% {
            transform: scale(2);
            opacity: 0;
          }
        }
        @keyframes slideIn {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .request-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 12px 36px rgba(15,23,42,0.05) !important;
        }
      `}</style>
    </div>
  );
}