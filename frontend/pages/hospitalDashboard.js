import axios from "axios";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import { io } from "socket.io-client";
import LiveChat from "../components/LiveChat";
import Link from "next/link";

let socket = null;

// Live timer formatter
function getRemainingTime(expiresAt) {
  const diff = new Date(expiresAt) - new Date();
  if (diff <= 0) return "Expired";

  const mins = Math.floor(diff / 60000);
  const secs = Math.floor((diff % 60000) / 1000);

  return `${mins}m ${secs}s`;
}

const statusColors = {
  pending: { bg: "#fff8e1", color: "#f59e0b", border: "#fde68a" },
  resolved: { bg: "#f0fdf4", color: "#16a34a", border: "#bbf7d0" },
  dismissed: { bg: "#f8fafc", color: "#64748b", border: "#e2e8f0" },
};

const STATUS_TABS = [
  { key: "all", label: "All" },
  { key: "open", label: "Open" },
  { key: "fulfilled", label: "Fulfilled" },
  { key: "completed", label: "Completed" },
  { key: "cancelled", label: "Cancelled" },
];

export default function HospitalDashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("requests");
  const [userProfile, setUserProfile] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);

  const [formData, setFormData] = useState({ name: "", phone: "", profilePhoto: "" });

  const [form, setForm] = useState({ bloodGroup: "", units: "", urgency: "normal", broadcastDuration: "2" });
  const [isCamp, setIsCamp] = useState(false);
  const [customCamp, setCustomCamp] = useState({ city: "", lat: null, lng: null });

  // Reporting State
  const [reportTarget, setReportTarget] = useState(null);
  const [reportReason, setReportReason] = useState("");

  // Edit Request modal state
  const [editTarget, setEditTarget] = useState(null);
  const [editForm, setEditForm] = useState({ units: "", urgency: "normal" });

  const [requests, setRequests] = useState([]);
  const [summary, setSummary] = useState({ total: 0, open: 0, fulfilled: 0, completed: 0, cancelled: 0 });
  const [tick, setTick] = useState(0);

  // Cancel confirmation modal
  const [cancelTarget, setCancelTarget] = useState(null);

  // My Reports tab
  const [myReports, setMyReports] = useState([]);
  const [reportsLoading, setReportsLoading] = useState(false);

  // Live notification banner (from socket)
  const [notification, setNotification] = useState(null);

  const [chatRecipient, setChatRecipient] = useState(null);
  const [messageUnread, setMessageUnread] = useState(0);

  // Derived Activity Log from requests
  const activityLog = useMemo(() => {
    const logs = [];
    requests.forEach(req => {
      if (req.acceptedDonors && req.acceptedDonors.length > 0) {
        req.acceptedDonors.forEach(donor => {
          logs.push({
            requestId: req._id,
            bloodGroup: req.bloodGroup,
            units: req.units,
            status: req.status,
            donorInfo: donor
          });
        });
      }
    });
    return logs.reverse(); // Show most recently mapped roughly
  }, [requests]);

  // Filters
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterBloodGroup, setFilterBloodGroup] = useState("all");
  const [filterUrgency, setFilterUrgency] = useState("all");

  const fetchProfile = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get("http://localhost:5000/api/user/me", {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUserProfile(res.data);
      setFormData({
        name: res.data.name || "",
        phone: res.data.phone || "",
        profilePhoto: res.data.profilePhoto || ""
      });
    } catch (err) { }
  };

  const fetchHospitalRequests = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get("http://localhost:5000/api/requests/hospital/my", {
        headers: { Authorization: `Bearer ${token}` }
      });
      setRequests(res.data.requests || res.data);
      if (res.data.summary) setSummary(res.data.summary);
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        localStorage.clear();
        router.push("/login");
      }
    }
  };
  const fetchMyReports = async () => {
    setReportsLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get("http://localhost:5000/api/user/my-reports", {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMyReports(res.data);
    } catch (err) { }
    finally { setReportsLoading(false); }
  };

  const handleDeleteReport = async (id) => {
    if (!confirm("Are you sure you want to remove this report record?")) return;
    try {
      const token = localStorage.getItem("token");
      await axios.delete(`http://localhost:5000/api/user/reports/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchMyReports();
    } catch (err) { alert("Failed to remove report"); }
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    
    const token = localStorage.getItem("token");
    const role = localStorage.getItem("role");

    if (!token || role !== "hospital") {
      router.push("/login");
      return;
    }

    setAuthChecked(true);
    
    if (!socket) {
      socket = io("http://localhost:5000");
    }
    
    socket.emit("join", token);

    fetchProfile();
    fetchHospitalRequests();

    const handleDonorAccepted = (data) => {
      setRequests((prev) =>
        prev.map((r) => {
          if (r._id !== data.requestId) return r;
          const existingIds = (r.acceptedDonors || []).map((d) => d._id || d);
          const donorAlreadyListed = existingIds.includes(data.donorInfo?._id);
          return {
            ...r,
            status: data.status || r.status,
            acceptedDonors: donorAlreadyListed
              ? r.acceptedDonors
              : [...(r.acceptedDonors || []), data.donorInfo],
          };
        })
      );
      setNotification({
        type: "success",
        message: `🩸 ${data.donorInfo?.name || "A donor"} accepted! Accepted Donors: ${data.acceptedCount} / ${data.units}`,
      });
      setTimeout(() => setNotification(null), 8000);
      fetchHospitalRequests();
    };

    const handleRequestFulfilled = (data) => {
      setRequests((prev) =>
        prev.map((r) =>
          r._id === data.requestId
            ? { ...r, status: "fulfilled", broadcastStatus: "stopped", acceptedDonors: r.acceptedDonors }
            : r
        )
      );
      setNotification({
        type: "success",
        message: `✅ Request fulfilled! All ${data.units} units have accepted donors (${data.acceptedCount} / ${data.units}).`,
      });
      setTimeout(() => setNotification(null), 10000);
      fetchHospitalRequests();
    };

    socket.on("donor-accepted", handleDonorAccepted);
    socket.on("request-fulfilled", handleRequestFulfilled);

    socket.on("request-deleted", (data) => {
      setRequests((prev) => prev.filter((r) => r._id !== data.requestId));
    });

    // 🔔 When admin resolves/dismisses a report
    socket.on("report-resolved", (data) => {
      console.log("Socket: report-resolved received", data);
      const isResolved = data.status === "resolved";

      setNotification({
        type: isResolved ? "success" : "info",
        message: isResolved
          ? `✅ Your report about ${data.targetName} has been RESOLVED by admin.`
          : `ℹ️ Your report about ${data.targetName} was reviewed and dismissed by admin.`,
        notes: data.adminNotes,
      });

      // Refetch the reports list to ensure total consistency
      fetchMyReports();

      setTimeout(() => setNotification(null), 10000);
    });

    return () => {
      socket.off("donor-accepted", handleDonorAccepted);
      socket.off("request-fulfilled", handleRequestFulfilled);
      socket.off("request-deleted");
      socket.off("report-resolved");
    };
  }, [router]);

  // Fetch reports when tab switches to "reports"
  useEffect(() => {
    if (activeTab === "reports") fetchMyReports();
  }, [activeTab]);

  // Timer Tick
  useEffect(() => {
    const interval = setInterval(() => setTick((prev) => prev + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  // Refresh requests periodically
  useEffect(() => {
    const interval = setInterval(() => fetchHospitalRequests(), 30000);
    return () => clearInterval(interval);
  }, []);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const createRequest = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem("token");
      const payload = { ...form };

      if (isCamp) {
        if (!customCamp.city || !customCamp.lat || !customCamp.lng) {
          return alert("Please detect camp location first!");
        }
        payload.customLocation = customCamp;
      }

      await axios.post("http://localhost:5000/api/requests/create", payload, {
        headers: { Authorization: `Bearer ${token}` }
      });

      alert("Request Created successfully!");
      setForm({ bloodGroup: "", units: "", urgency: "normal", broadcastDuration: "2" });
      setIsCamp(false);
      setCustomCamp({ city: "", lat: null, lng: null });
      fetchHospitalRequests();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to create request");
    }
  };

  const confirmCancelRequest = async () => {
    if (!cancelTarget) return;
    try {
      const token = localStorage.getItem("token");
      await axios.put(`http://localhost:5000/api/requests/cancel/${cancelTarget._id}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCancelTarget(null);
      fetchHospitalRequests();
    } catch (err) { alert(err.response?.data?.message || "Cancel failed"); }
  };

  const cancelRequest = (req) => {
    if (req.status === "completed") return alert("Cannot cancel a completed request.");
    setCancelTarget(req);
  };

  const extendBroadcast = async (req) => {
    if (!confirm("Extend the broadcast window by 2 hours and resume notifications?")) return;
    try {
      const token = localStorage.getItem("token");
      await axios.post(`http://localhost:5000/api/requests/extend-broadcast/${req._id}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert("✅ Broadcast extended! Donors are being notified.");
      fetchHospitalRequests();
    } catch (err) { alert(err.response?.data?.message || "Extend failed"); }
  };

  const deleteRequest = async (req) => {
    if (req.status === "completed") return alert("Cannot delete a completed request.");
    if (!confirm("Delete this request? Accepted donors will be notified.")) return;
    try {
      const token = localStorage.getItem("token");
      await axios.delete(`http://localhost:5000/api/requests/delete/${req._id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchHospitalRequests();
    } catch (err) { alert(err.response?.data?.message || "Delete failed"); }
  };

  const completeRequest = async (id) => {
    try {
      const token = localStorage.getItem("token");
      await axios.post(`http://localhost:5000/api/requests/complete/${id}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert("Marked Completed");
      fetchHospitalRequests();
    } catch (err) { alert("Failed"); }
  };

  const openEditModal = (req) => {
    setEditTarget(req);
    setEditForm({ units: req.units, urgency: req.urgency });
  };

  const submitEditRequest = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem("token");
      await axios.put(`http://localhost:5000/api/requests/${editTarget._id}`, editForm, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert("Request updated!");
      setEditTarget(null);
      fetchHospitalRequests();
    } catch (err) { alert(err.response?.data?.message || "Update failed"); }
  };

  const updateDonorProgress = async (requestId, donorId, status) => {
    try {
      const token = localStorage.getItem("token");
      await axios.put("http://localhost:5000/api/requests/donor-progress", { requestId, donorId, status }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchHospitalRequests();
    } catch (err) { alert(err.response?.data?.message || "Status update failed"); }
  };

  const handleReportUser = async (e) => {
    e.preventDefault();
    if (!reportReason.trim()) return alert("Please provide a reason.");
    try {
      const token = localStorage.getItem("token");
      await axios.post(
        "http://localhost:5000/api/user/report",
        {
          targetId: reportTarget._id,
          reason: reportReason,
          requestId: reportTarget.requestId,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert("Report submitted successfully.");
      setReportTarget(null);
      setReportReason("");
      if (activeTab === "reports") fetchMyReports();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to submit report");
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem("token");
      // Explicitly prevent sending city mapping out of bounds for Hospital.
      // Even if sent, controller ignores it if not donor, but let's be safe.
      await axios.put("http://localhost:5000/api/user/profile", formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert("Profile Updated!");
      fetchProfile();
    } catch (err) {
      alert(err.response?.data?.message || "Update Failed");
    }
  };

  const handlePhotoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, profilePhoto: reader.result });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAutoLocation = () => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition((pos) => {
        const { latitude, longitude } = pos.coords;
        axios.get(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`)
          .then(res => {
            if (res.data && res.data.address) {
              const city = res.data.address.city || res.data.address.town || res.data.address.village;
              if (city) {
                setCustomCamp({ city, lat: latitude, lng: longitude });
                alert("Camp Location Autosaved: " + city);
              } else alert("Could not detect city");
            }
          })
          .catch(() => alert("Reverse geocoding failed."));
      }, () => alert("Location access denied."));
    } else alert("Geolocation not supported.");
  };

  const handleLogout = () => {
    localStorage.clear();
    router.push("/login");
  };

  if (!authChecked) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#f0f2f5" }}>
        <p style={{ color: "#64748b" }}>Loading hospital dashboard...</p>
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: "#f0f2f5", minHeight: "100vh", fontFamily: "Arial", paddingBottom: "50px" }}>

      {/* 🔔 LIVE NOTIFICATION BANNER */}
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
          <h2 style={{ margin: 0, color: "#1d3557", display: "flex", alignItems: "center", gap: "8px" }}>
            🏥 Hospital Dashboard
          </h2>
        </div>

        <div style={{ display: "flex", gap: "25px", alignItems: "center" }}>
          <span onClick={() => setActiveTab("requests")} style={{ cursor: "pointer", fontSize: "16px", fontWeight: "bold", color: activeTab === "requests" ? "#1d3557" : "#555", borderBottom: activeTab === "requests" ? "2px solid #1d3557" : "none", paddingBottom: "5px" }}>
            Create & Manage Alerts
          </span>
          <span onClick={() => { setActiveTab("messages"); setChatRecipient(null); }} style={{ cursor: "pointer", fontSize: "16px", fontWeight: "bold", color: activeTab === "messages" ? "#1d3557" : "#555", borderBottom: activeTab === "messages" ? "2px solid #1d3557" : "none", paddingBottom: "5px" }}>
            💬 Messages{messageUnread > 0 && activeTab !== "messages" ? ` (${messageUnread})` : ""}
          </span>
          <span onClick={() => setActiveTab("updates")} style={{ cursor: "pointer", fontSize: "16px", fontWeight: "bold", color: activeTab === "updates" ? "#1d3557" : "#555", borderBottom: activeTab === "updates" ? "2px solid #1d3557" : "none", paddingBottom: "5px" }}>
            Activity Log ({activityLog.length})
          </span>
          <span onClick={() => setActiveTab("reports")} style={{ cursor: "pointer", fontSize: "16px", fontWeight: "bold", color: activeTab === "reports" ? "#1d3557" : "#555", borderBottom: activeTab === "reports" ? "2px solid #1d3557" : "none", paddingBottom: "5px" }}>
            My Reports {myReports.filter(r => r.status !== "pending").length > 0 && activeTab !== "reports" ? "🔴" : ""}
          </span>
          <span onClick={() => setActiveTab("profile")} style={{ cursor: "pointer", fontSize: "16px", fontWeight: "bold", color: activeTab === "profile" ? "#1d3557" : "#555", borderBottom: activeTab === "profile" ? "2px solid #1d3557" : "none", paddingBottom: "5px" }}>
            My Hospital
          </span>
          <span onClick={() => setActiveTab("settings")} style={{ cursor: "pointer", fontSize: "16px", fontWeight: "bold", color: activeTab === "settings" ? "#1d3557" : "#555", borderBottom: activeTab === "settings" ? "2px solid #1d3557" : "none", paddingBottom: "5px" }}>
            Settings
          </span>

          {/* NAVBAR PROFILE PHOTO & LOGOUT */}
          {userProfile && (
            <div style={{ display: "flex", alignItems: "center", gap: "15px", borderLeft: "2px solid #eee", paddingLeft: "20px" }}>
              {userProfile.profilePhoto ? (
                <img src={userProfile.profilePhoto} alt="Nav" style={{ height: "40px", width: "40px", borderRadius: "50%", objectFit: "cover", border: "2px solid #ddd" }} />
              ) : (
                <div style={{ height: "40px", width: "40px", backgroundColor: "#1d3557", color: "white", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px", fontWeight: "bold", border: "2px solid #eee" }}>
                  {(userProfile.name || "").charAt(0).toUpperCase()}
                </div>
              )}
              <button
                onClick={handleLogout}
                style={{ backgroundColor: "#ff4d4f", color: "white", border: "none", padding: "8px 15px", borderRadius: "6px", cursor: "pointer", fontWeight: "bold", boxShadow: "0 2px 4px rgba(0,0,0,0.1)" }}
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </nav>

      {/* CONTENT AREA */}
      <div style={{ maxWidth: activeTab === "messages" ? "1100px" : "800px", margin: "30px auto", padding: "0 20px" }}>

        {/* REQUESTS VIEW */}
        {activeTab === "requests" && (
          <>
            {/* HOSPITAL DASHBOARD SUMMARY */}
            <div style={{ backgroundColor: "white", padding: "20px", borderRadius: "12px", boxShadow: "0 4px 12px rgba(0,0,0,0.05)", marginBottom: "30px" }}>
              <h3 style={{ margin: "0 0 20px 0", color: "#1d3557", textAlign: "center" }}>Hospital Summary</h3>
              <div style={{ display: "flex", justifyContent: "space-between", textAlign: "center" }}>
              <div style={{ flex: 1, borderRight: "1px solid #eee" }}>
                <h4 style={{ margin: "0 0 5px 0", color: "#64748b" }}>Total Requests</h4>
                <p style={{ margin: 0, fontSize: "24px", fontWeight: "bold", color: "#1d3557" }}>{summary.total ?? requests.length}</p>
              </div>
              <div style={{ flex: 1, borderRight: "1px solid #eee" }}>
                <h4 style={{ margin: "0 0 5px 0", color: "#64748b" }}>Open Requests</h4>
                <p style={{ margin: 0, fontSize: "24px", fontWeight: "bold", color: "#f59e0b" }}>{summary.open ?? requests.filter(r => r.status === "open").length}</p>
              </div>
              <div style={{ flex: 1, borderRight: "1px solid #eee" }}>
                <h4 style={{ margin: "0 0 5px 0", color: "#64748b" }}>Completed Requests</h4>
                <p style={{ margin: 0, fontSize: "24px", fontWeight: "bold", color: "#10b981" }}>{summary.completed ?? requests.filter(r => r.status === "completed").length}</p>
              </div>
              <div style={{ flex: 1 }}>
                <h4 style={{ margin: "0 0 5px 0", color: "#64748b" }}>Cancelled Requests</h4>
                <p style={{ margin: 0, fontSize: "24px", fontWeight: "bold", color: "#ef4444" }}>{summary.cancelled ?? requests.filter(r => r.status === "cancelled").length}</p>
              </div>
              </div>
            </div>

            {/* CREATE NEW REQUEST CARD */}
            <div style={{ backgroundColor: "white", padding: "25px", borderRadius: "12px", boxShadow: "0 4px 12px rgba(0,0,0,0.05)", marginBottom: "30px" }}>
              <h3 style={{ marginTop: 0, color: "#1d3557", borderBottom: "2px solid #eee", paddingBottom: "10px" }}>Publish Emergency Request</h3>
              <form onSubmit={createRequest} style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
                <div style={{ display: "flex", gap: "15px" }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontWeight: "bold", color: "#555", display: "block", marginBottom: "5px" }}>Blood Group</label>
                    <select name="bloodGroup" value={form.bloodGroup} onChange={handleChange} required style={{ width: "95%", padding: "10px", borderRadius: "6px", border: "1px solid #ccc", backgroundColor: "white" }}>
                      <option value="" disabled>Select Blood Group</option>
                      <option value="A+">A+</option>
                      <option value="A-">A-</option>
                      <option value="B+">B+</option>
                      <option value="B-">B-</option>
                      <option value="AB+">AB+</option>
                      <option value="AB-">AB-</option>
                      <option value="O+">O+</option>
                      <option value="O-">O-</option>
                    </select>
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontWeight: "bold", color: "#555", display: "block", marginBottom: "5px" }}>Units</label>
                    <input name="units" type="number" placeholder="Number of units" value={form.units} onChange={handleChange} required style={{ width: "95%", padding: "10px", borderRadius: "6px", border: "1px solid #ccc" }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontWeight: "bold", color: "#555", display: "block", marginBottom: "5px" }}>Urgency Level</label>
                    <select name="urgency" value={form.urgency} onChange={handleChange} style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid #ccc" }}>
                      <option value="normal">Normal</option>
                      <option value="urgent">Urgent</option>
                      <option value="critical">Critical</option>
                    </select>
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontWeight: "bold", color: "#555", display: "block", marginBottom: "5px" }}>Broadcast Duration</label>
                    <select name="broadcastDuration" value={form.broadcastDuration} onChange={handleChange} style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid #ccc" }}>
                      <option value="1">1 Hour</option>
                      <option value="2">2 Hours</option>
                      <option value="4">4 Hours</option>
                      <option value="6">6 Hours</option>
                      <option value="12">12 Hours</option>
                      <option value="24">24 Hours</option>
                    </select>
                  </div>
                </div>

                {/* CAMP LOCATION TOGGLE */}
                <div style={{ backgroundColor: "#f9f9f9", padding: "15px", borderRadius: "8px", border: "1px solid #ddd" }}>
                  <label style={{ fontWeight: "bold", color: "#555", display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }}>
                    <input type="checkbox" checked={isCamp} onChange={(e) => setIsCamp(e.target.checked)} style={{ transform: "scale(1.2)" }} />
                    This request is for an external Donation Camp
                  </label>

                  {isCamp && (
                    <div style={{ marginTop: "15px", display: "flex", alignItems: "center", gap: "15px" }}>
                      <button type="button" onClick={handleAutoLocation} style={{ backgroundColor: "#1d3557", color: "white", padding: "10px 15px", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" }}>
                        📍 Detect Camp Location
                      </button>
                      {customCamp.city && (
                        <span style={{ color: "green", fontWeight: "bold" }}>✓ Location set: {customCamp.city}</span>
                      )}
                    </div>
                  )}
                </div>

                <button type="submit" style={{ backgroundColor: "#e63946", color: "white", padding: "12px", border: "none", borderRadius: "6px", fontWeight: "bold", cursor: "pointer", fontSize: "16px", marginTop: "10px" }}>
                  Broadcast Request to Donors
                </button>
              </form>
            </div>

            <h3>Request History</h3>

            {/* STATUS FILTER TABS */}
            <div style={{ display: "flex", gap: "8px", marginBottom: "16px", flexWrap: "wrap" }}>
              {STATUS_TABS.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setFilterStatus(tab.key)}
                  style={{
                    padding: "8px 16px",
                    borderRadius: "20px",
                    border: filterStatus === tab.key ? "2px solid #1d3557" : "1px solid #cbd5e1",
                    backgroundColor: filterStatus === tab.key ? "#1d3557" : "white",
                    color: filterStatus === tab.key ? "white" : "#475569",
                    fontWeight: "bold",
                    cursor: "pointer",
                    fontSize: "13px",
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* ADDITIONAL FILTERS */}
            <div style={{ display: "flex", gap: "15px", marginBottom: "20px", background: "white", padding: "15px", borderRadius: "8px", boxShadow: "0 2px 5px rgba(0,0,0,0.05)", alignItems: "center" }}>
              <span style={{ fontWeight: "bold", color: "#1d3557" }}>🔍 Filter By:</span>

              <div style={{ flex: 1 }}>
                <select value={filterBloodGroup} onChange={(e) => setFilterBloodGroup(e.target.value)} style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #ccc", backgroundColor: "white" }}>
                  <option value="all">All Blood Groups</option>
                  <option value="A+">A+</option>
                  <option value="A-">A-</option>
                  <option value="B+">B+</option>
                  <option value="B-">B-</option>
                  <option value="AB+">AB+</option>
                  <option value="AB-">AB-</option>
                  <option value="O+">O+</option>
                  <option value="O-">O-</option>
                </select>
              </div>

              <div style={{ flex: 1 }}>
                <select value={filterUrgency} onChange={(e) => setFilterUrgency(e.target.value)} style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #ccc", backgroundColor: "white" }}>
                  <option value="all">All Urgency</option>
                  <option value="normal">Normal</option>
                  <option value="urgent">Urgent</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
            </div>

            {requests.filter(req => {
              let statusMatch = filterStatus === "all" || req.status === filterStatus;
              let bgMatch = filterBloodGroup === "all" || req.bloodGroup === filterBloodGroup;
              let urgMatch = filterUrgency === "all" || req.urgency === filterUrgency;
              return statusMatch && bgMatch && urgMatch;
            }).length === 0 ? (
              <p style={{ color: "#666", textAlign: "center", padding: "30px", border: "2px dashed #ddd", borderRadius: "8px" }}>No requests match your filters.</p>
            ) : (
              requests.filter(req => {
                let statusMatch = filterStatus === "all" || req.status === filterStatus;
                let bgMatch = filterBloodGroup === "all" || req.bloodGroup === filterBloodGroup;
                let urgMatch = filterUrgency === "all" || req.urgency === filterUrgency;
                return statusMatch && bgMatch && urgMatch;
              }).map((req) => {
                const acceptedCount = req.acceptedDonors?.length || 0;
                const remaining = req.units - acceptedCount;
                const broadcastActive = req.broadcastStatus === "active";
                const broadcastStopped = req.broadcastStatus === "stopped";
                const timeLeft = req.expiresAt ? getRemainingTime(req.expiresAt) : "—";

                // Badge colors for request status
                const reqStatusStyle = {
                  open: { bg: "#e0f2fe", color: "#0369a1", label: "OPEN" },
                  fulfilled: { bg: "#dcfce7", color: "#166534", label: "FULFILLED" },
                  completed: { bg: "#d4edda", color: "#155724", label: "COMPLETED" },
                  cancelled: { bg: "#fee2e2", color: "#991b1b", label: "CANCELLED" },
                }[req.status] || { bg: "#f0f0f0", color: "#555", label: req.status?.toUpperCase() };

                return (
                  <div key={req._id} style={{ border: "1px solid #e0e0e0", borderLeft: `6px solid ${req.urgency === "critical" ? "darkred" : req.urgency === "urgent" ? "orange" : "#28a745"}`, borderRadius: "12px", margin: "15px 0", padding: "20px", boxShadow: "0 4px 12px rgba(0,0,0,0.05)", backgroundColor: "white" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div style={{ flex: 1 }}>
                        {/* Urgency tag */}
                        <span style={{ backgroundColor: req.urgency === "critical" ? "#ffe6e6" : req.urgency === "urgent" ? "#fff4e6" : "#e6ffe6", color: req.urgency === "critical" ? "darkred" : req.urgency === "urgent" ? "darkorange" : "darkgreen", padding: "4px 10px", borderRadius: "20px", fontSize: "12px", fontWeight: "bold", display: "inline-block", marginBottom: "8px", border: "1px solid", marginRight: "6px" }}>
                          {req.urgency ? req.urgency.toUpperCase() : "NORMAL"}
                        </span>

                        {/* Request Status badge */}
                        <span style={{ backgroundColor: reqStatusStyle.bg, color: reqStatusStyle.color, padding: "4px 10px", borderRadius: "20px", fontSize: "12px", fontWeight: "bold", display: "inline-block", marginBottom: "8px", border: "1px solid", marginRight: "6px" }}>
                          {reqStatusStyle.label}
                        </span>

                        {/* Broadcast Status badge */}
                        <span style={{
                          backgroundColor: broadcastActive ? "#e0f2fe" : "#f1f5f9",
                          color: broadcastActive ? "#0369a1" : "#64748b",
                          padding: "4px 10px", borderRadius: "20px", fontSize: "12px",
                          fontWeight: "bold", display: "inline-block", marginBottom: "8px", border: "1px solid"
                        }}>
                          📡 Broadcast: {broadcastActive ? "ACTIVE" : "STOPPED"}
                        </span>

                        <h3 style={{ margin: "0 0 10px 0", color: "#333", display: "flex", gap: "10px" }}>
                          <b>🧬 {req.bloodGroup}</b>
                          <span>|</span>
                          <span>{req.units} Units required</span>
                        </h3>
                        <p style={{ margin: "5px 0", color: "#555" }}>
                          📍 <b>Location:</b> {req.location?.city || "Hospital Address"}
                          {userProfile?.location && req.location?.city !== userProfile.location.city && " (Camp)"}
                        </p>
                        <p style={{ margin: "5px 0", color: "#888", fontSize: "13px" }}>
                          📅 Created: {req.createdAt ? new Date(req.createdAt).toLocaleString() : "—"}
                        </p>

                        <div style={{ display: "flex", gap: "15px", marginTop: "15px", fontSize: "14px", flexWrap: "wrap" }}>
                          <span style={{ backgroundColor: "#f0f2f5", padding: "5px 10px", borderRadius: "4px", fontWeight: "bold" }}>
                            ✅ Accepted Donors: {acceptedCount} / {req.units}
                          </span>
                          <span style={{ backgroundColor: remaining > 0 ? "#fff3cd" : "#d4edda", color: remaining > 0 ? "#856404" : "#155724", padding: "5px 10px", borderRadius: "4px", fontWeight: "bold" }}>
                            ⏳ Remaining: {remaining}
                          </span>
                          {req.status === "completed" && (
                            <span style={{ backgroundColor: "#d4edda", padding: "5px 10px", borderRadius: "4px", color: "#155724", fontWeight: "bold" }}>
                              🎉 Completed
                            </span>
                          )}
                        </div>
                      </div>

                      <div style={{ textAlign: "right", minWidth: "170px" }}>
                        {req.status === "open" && (
                          <p style={{ margin: "0 0 6px 0", fontSize: "14px" }}>
                            <b>Broadcast Window:</b>{" "}
                            <span style={{ color: broadcastActive ? "#007bff" : "#e53e3e", fontWeight: "bold" }}>
                              {broadcastActive ? timeLeft : "⏹ Stopped"}
                            </span>
                          </p>
                        )}
                      </div>
                    </div>

                    {acceptedCount > 0 && (
                      <div style={{ marginTop: "15px", backgroundColor: "#f8f9fa", border: "1px solid #e9ecef", padding: "15px", borderRadius: "8px" }}>
                        <h4 style={{ margin: "0 0 10px 0", color: "#495057" }}>👥 Accepted Donors</h4>
                        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                          {req.acceptedDonors.map((d, idx) => {
                            const progress = req.donorProgress?.find(p => p.donorId === d._id || p.donorId?.toString() === d._id);
                            const donorStatus = progress?.status || "accepted";
                            const statusColor = donorStatus === "donated" ? { bg: "#d4edda", color: "#155724" } : donorStatus === "reached" ? { bg: "#cce5ff", color: "#004085" } : { bg: "#fff3cd", color: "#856404" };
                            return (
                              <div key={d._id} style={{ backgroundColor: "white", padding: "12px 15px", borderRadius: "8px", border: "1px solid #dee2e6", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
                                <div>
                                  <b style={{ color: "#212529" }}>{idx + 1}. {d.name}</b>
                                  <div style={{ fontSize: "13px", color: "#6c757d", marginTop: "3px" }}>
                                    🩸 {d.bloodGroup || "—"} &nbsp;|&nbsp; 📞 {d.phone} &nbsp;|&nbsp; ✉️ {d.email || "—"}
                                  </div>
                                  <div style={{ fontSize: "12px", color: "#64748b", marginTop: "2px" }}>
                                    Availability: <b>{d.availability || "available"}</b>
                                  </div>
                                </div>
                                <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                                  {/* Module 4: donor progress stepper */}
                                  {["accepted", "reached", "donated"].map(s => (
                                    <button key={s} type="button"
                                      onClick={() => updateDonorProgress(req._id, d._id, s)}
                                      style={{
                                        padding: "4px 10px", fontSize: "11px", fontWeight: "bold",
                                        borderRadius: "12px", border: "1.5px solid",
                                        cursor: "pointer",
                                        backgroundColor: donorStatus === s ? statusColor.bg : "#f8fafc",
                                        color: donorStatus === s ? statusColor.color : "#64748b",
                                        borderColor: donorStatus === s ? statusColor.color : "#cbd5e1",
                                      }}>
                                      {s === "accepted" ? "✅ Accepted" : s === "reached" ? "🏥 Reached" : "🩸 Donated"}
                                    </button>
                                  ))}
                                  <button type="button"
                                    onClick={() => { setActiveTab("messages"); setChatRecipient({ _id: d._id, name: d.name, role: "donor", requestId: req._id }); }}
                                    style={{ background: "none", border: "none", color: "#1d4ed8", cursor: "pointer", fontSize: "11px", fontWeight: "bold", textDecoration: "underline" }}>
                                    💬 Message
                                  </button>
                                  <button onClick={() => setReportTarget({ ...d, requestId: req._id })}
                                    style={{ background: "none", border: "none", color: "#dc3545", cursor: "pointer", fontSize: "11px", fontWeight: "bold", textDecoration: "underline" }}>
                                    🚩 Report
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <div style={{ marginTop: "15px", display: "flex", gap: "10px", justifyContent: "flex-end", flexWrap: "wrap" }}>
                      <Link href={`/hospital/request/${req._id}`} style={{ background: "#f1f5f9", color: "#334155", padding: "8px 15px", borderRadius: "6px", fontWeight: "bold", textDecoration: "none", fontSize: "14px" }}>
                        📋 View Details
                      </Link>
                      {/* Extend Broadcast — shown when broadcast is stopped and request is still open */}
                      {req.status === "open" && req.broadcastStatus === "stopped" && (
                        <button style={{ background: "#dbeafe", color: "#1d4ed8", padding: "8px 15px", border: "none", borderRadius: "6px", fontWeight: "bold", cursor: "pointer" }} onClick={() => extendBroadcast(req)}>
                          📡 Extend Broadcast
                        </button>
                      )}
                      {/* Cancel Request — shown when open or fulfilled */}
                      {["open", "fulfilled"].includes(req.status) && (
                        <button style={{ background: "#fee2e2", color: "#991b1b", padding: "8px 15px", border: "none", borderRadius: "6px", fontWeight: "bold", cursor: "pointer" }} onClick={() => cancelRequest(req)}>
                          🚫 Cancel Request
                        </button>
                      )}
                      {req.status === "open" && (
                        <button style={{ background: "#e0e7ff", color: "#3730a3", padding: "8px 15px", border: "none", borderRadius: "6px", fontWeight: "bold", cursor: "pointer" }} onClick={() => openEditModal(req)}>
                          ✏️ Edit
                        </button>
                      )}
                      {req.status !== "completed" && req.status !== "cancelled" && (
                        <button style={{ background: "#f8d7da", color: "#721c24", padding: "8px 15px", border: "none", borderRadius: "6px", fontWeight: "bold", cursor: "pointer" }} onClick={() => deleteRequest(req)}>
                          🗑️ Delete
                        </button>
                      )}
                      {req.status === "fulfilled" && (
                        <button style={{ background: "#28a745", color: "white", padding: "8px 15px", border: "none", borderRadius: "6px", fontWeight: "bold", cursor: "pointer" }} onClick={() => completeRequest(req._id)}>
                          ✅ Mark Completed
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </>
        )}

        {activeTab === "messages" && (
          <div>
            <p style={{ color: "#64748b", fontSize: "14px", marginBottom: "16px" }}>
              Message confirmed donors or contact admin for help.
            </p>
            <LiveChat
              socket={socket}
              theme="hospital"
              initialRecipient={chatRecipient}
              onUnreadChange={setMessageUnread}
            />
          </div>
        )}

        {/* ACTIVITY LOG */}
        {activeTab === "updates" && (
          <div style={{ backgroundColor: "white", padding: "30px", borderRadius: "12px", boxShadow: "0 4px 12px rgba(0,0,0,0.05)" }}>
            <h3 style={{ marginTop: 0, color: "#1d3557", borderBottom: "2px solid #eee", paddingBottom: "10px" }}>Donor Response Tracker</h3>
            {activityLog.length === 0 ? (
              <p style={{ color: "#666" }}>No responses yet.</p>
            ) : (
              activityLog.map((log, i) => (
                <div key={i} style={{ borderLeft: "4px solid #1d3557", backgroundColor: "#f9f9f9", padding: "15px", marginBottom: "15px", borderRadius: "4px" }}>
                  <p style={{ margin: "0 0 5px 0", color: "#333" }}><b>Confirmed Response for {log.bloodGroup} Request</b> (ID: {log.requestId})</p>
                  {log.donorInfo && (
                    <p style={{ margin: "0 0 5px 0", color: "#555" }}>
                      🩸 <b>{log.donorInfo.name}</b> has committed to donate! 📞 {log.donorInfo.phone}
                    </p>
                  )}
                  <span style={{ fontSize: "14px", fontWeight: "bold", color: log.status === "fulfilled" || log.status === "completed" ? "green" : "#ff8c00" }}>
                    Status: {log.status.toUpperCase()}
                  </span>
                </div>
              ))
            )}
          </div>
        )}

        {/* 📋 MY REPORTS TAB */}
        {activeTab === "reports" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h3 style={{ margin: 0, color: "#1d3557" }}>Submitted Reports & Replies</h3>
              <div style={{ display: "flex", gap: "10px" }}>
                <button onClick={fetchMyReports} style={{ padding: "8px 16px", borderRadius: "8px", border: "1px solid #ccc", background: "white", cursor: "pointer", fontWeight: "bold", color: "#555" }}>
                  🔄 Refresh
                </button>
              </div>
            </div>

            {reportsLoading ? (
              <p style={{ textAlign: "center", padding: "40px", color: "#888" }}>Loading your reports...</p>
            ) : myReports.length === 0 ? (
              <div style={{ textAlign: "center", padding: "50px", backgroundColor: "white", borderRadius: "12px", border: "2px dashed #ddd", color: "#666" }}>
                <div style={{ fontSize: "48px", marginBottom: "12px" }}>📭</div>
                <h3 style={{ margin: "0 0 8px 0" }}>No reports submitted yet</h3>
                <p style={{ margin: 0 }}>If a donor provides fake details or doesn't show up, use the 🚩 Report Donor button.</p>
              </div>
            ) : (
              myReports.map((report) => {
                const sc = statusColors[report.status] || statusColors.pending;
                return (
                  <div key={report._id} style={{
                    backgroundColor: "white", border: `1px solid ${sc.border}`,
                    borderLeft: `5px solid ${sc.color}`, borderRadius: "12px",
                    padding: "20px", marginBottom: "16px",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.04)",
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "10px" }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px", flexWrap: "wrap", justifyContent: "space-between" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                            <span style={{
                              backgroundColor: sc.bg, color: sc.color, border: `1px solid ${sc.border}`,
                              padding: "4px 12px", borderRadius: "20px", fontSize: "11px", fontWeight: "800",
                              letterSpacing: "0.5px",
                            }}>
                              {report.status.toUpperCase()}
                            </span>
                            <span style={{ color: "#94a3b8", fontSize: "12px", fontWeight: "600" }}>
                              Submitted: {new Date(report.createdAt).toLocaleDateString()}
                            </span>
                          </div>

                          {(report.status === "resolved" || report.status === "dismissed") && (
                            <button onClick={() => handleDeleteReport(report._id)} style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: "11px", fontWeight: "bold", textDecoration: "underline" }}>
                              Remove Record
                            </button>
                          )}
                        </div>

                        <p style={{ margin: "0 0 10px 0", color: "#333", fontSize: "15px", fontWeight: "600" }}>
                          📋 Reason: {report.reason}
                        </p>

                        <div style={{ display: "flex", gap: "20px", flexWrap: "wrap" }}>
                          <div>
                            <div style={{ fontSize: "11px", color: "#94a3b8", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "4px" }}>Reported User</div>
                            <div style={{ color: "#334155", fontSize: "14px", fontWeight: "700" }}>
                              👤 {report.targetId?.name || "Unknown"}
                              <span style={{ color: "#64748b", fontWeight: "500", fontSize: "12px", marginLeft: "6px" }}>({report.targetId?.role})</span>
                            </div>
                          </div>
                        </div>

                        {report.status === "pending" && (
                          <div style={{ marginTop: "14px", backgroundColor: "#fff8e1", border: "1px solid #fde68a", borderRadius: "8px", padding: "12px 14px" }}>
                            <p style={{ margin: 0, fontSize: "13px", color: "#92400e", fontWeight: "600" }}>
                              ⏳ <b>Pending Review</b> — Admin is reviewing your report. You will receive a live notification here once it is resolved or dismissed.
                            </p>
                          </div>
                        )}

                        {report.status === "resolved" && (
                          <div style={{ marginTop: "14px", backgroundColor: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "8px", padding: "12px 14px" }}>
                            <p style={{ margin: "0 0 6px 0", fontSize: "13px", color: "#15803d", fontWeight: "700" }}>
                              ✅ <b>Resolved</b> — Admin has taken action and replied to your report.
                            </p>
                            {report.adminNotes && (
                              <p style={{ margin: 0, fontSize: "13px", color: "#166534", fontStyle: "italic" }}>
                                Admin Response: "{report.adminNotes}"
                              </p>
                            )}
                          </div>
                        )}

                        {report.status === "dismissed" && (
                          <div style={{ marginTop: "14px", backgroundColor: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "12px 14px" }}>
                            <p style={{ margin: "0 0 6px 0", fontSize: "13px", color: "#64748b", fontWeight: "700" }}>
                              ℹ️ <b>Dismissed</b> — Admin reviewed but did not find sufficient reason to act.
                            </p>
                            {report.adminNotes && (
                              <p style={{ margin: 0, fontSize: "13px", color: "#475569", fontStyle: "italic" }}>
                                Admin Response: "{report.adminNotes}"
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* HOSPITAL PROFILE */}
        {activeTab === "profile" && userProfile && (
          <div style={{ backgroundColor: "white", padding: "30px", borderRadius: "12px", boxShadow: "0 4px 12px rgba(0,0,0,0.05)" }}>
            <div style={{ display: "flex", gap: "20px", alignItems: "center", marginBottom: "30px", borderBottom: "2px solid #ddd", paddingBottom: "20px" }}>
              <div style={{ height: "80px", width: "80px", backgroundColor: "#1d3557", color: "white", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "30px", fontWeight: "bold", overflow: "hidden", border: "3px solid #eee" }}>
                {userProfile.profilePhoto ? (
                  <img src={userProfile.profilePhoto} alt="Profile" style={{ height: "100%", width: "100%", objectFit: "cover" }} />
                ) : (
                  <span>{userProfile.name?.charAt(0).toUpperCase()}</span>
                )}
              </div>
              <div>
                <h2 style={{ margin: "0", color: "#333" }}>{userProfile.name}</h2>
                <p style={{ margin: "5px 0 0 0", color: "#666" }}>{userProfile.email} | Contact: {userProfile.phone}</p>
              </div>
            </div>

            <div style={{ padding: "20px", backgroundColor: "#f9f9f9", borderRadius: "10px", border: "1px solid #ddd" }}>
              <h4 style={{ margin: "0 0 15px 0", color: "#555" }}>Organization Details</h4>
              <p style={{ margin: "5px 0" }}><b>Role:</b> Medical Institution / Hospital</p>
              <p style={{ margin: "5px 0" }}><b>Base Location:</b> {userProfile.location?.city || "Not Set"}</p>
            </div>
          </div>
        )}

        {/* SETTINGS (LOCATION NOT EDITABLE) */}
        {activeTab === "settings" && userProfile && (
          <div style={{ backgroundColor: "white", padding: "30px", borderRadius: "12px", boxShadow: "0 4px 12px rgba(0,0,0,0.05)" }}>
            <h3 style={{ marginTop: "0", color: "#1d3557", borderBottom: "2px solid #ddd", paddingBottom: "15px" }}>Edit Hospital Settings</h3>

            <form onSubmit={handleUpdateProfile} style={{ display: "flex", flexDirection: "column", gap: "15px", maxWidth: "450px" }}>

              <label style={{ fontWeight: "bold", color: "#555" }}>Hospital Name</label>
              <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} style={{ padding: "10px", borderRadius: "6px", border: "1px solid #ccc", fontSize: "15px" }} required />

              <label style={{ fontWeight: "bold", color: "#555" }}>Contact Number</label>
              <input type="text" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} style={{ padding: "10px", borderRadius: "6px", border: "1px solid #ccc", fontSize: "15px" }} required />

              <label style={{ fontWeight: "bold", color: "#555" }}>Logo / Identity Photo</label>
              <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
                {formData.profilePhoto && (
                  <img src={formData.profilePhoto} alt="Preview" style={{ height: "60px", width: "60px", borderRadius: "50%", objectFit: "cover", border: "2px solid #ddd" }} />
                )}
                <input type="file" accept="image/*" onChange={handlePhotoUpload} style={{ padding: "10px", borderRadius: "6px", border: "1px solid #ccc", fontSize: "15px", flex: 1, backgroundColor: "#f9f9f9" }} />
              </div>

              <label style={{ fontWeight: "bold", color: "#555" }}>Base Location (Fixed)</label>
              <input
                type="text"
                value={userProfile.location?.city || "Not Available"}
                disabled
                style={{ padding: "10px", borderRadius: "6px", border: "1px solid #ccc", fontSize: "15px", backgroundColor: "#e9ecef", cursor: "not-allowed", color: "#555" }}
              />
              <small style={{ color: "#888", marginTop: "-10px" }}>Hospital base location cannot be changed here. Use external 'Camp' alerts on the dashboard instead.</small>

              <button type="submit" style={{ backgroundColor: "#1d3557", color: "white", padding: "14px", border: "none", borderRadius: "6px", fontWeight: "bold", cursor: "pointer", marginTop: "15px", boxShadow: "0 4px 6px rgba(0,0,0,0.1)", fontSize: "16px" }}>
                Save Hospital Info
              </button>
            </form>
          </div>
        )}

        {/* CANCEL REQUEST CONFIRMATION MODAL */}
        {cancelTarget && (
          <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
            <div style={{ background: "white", padding: "30px", borderRadius: "12px", width: "420px", boxShadow: "0 10px 25px rgba(0,0,0,0.2)" }}>
              <h3 style={{ marginTop: 0, color: "#991b1b" }}>🚫 Cancel Request</h3>
              <p style={{ margin: "0 0 20px 0", color: "#666", fontSize: "15px" }}>
                Are you sure you want to cancel this request?
              </p>
              <p style={{ margin: "0 0 20px 0", color: "#475569", fontSize: "14px" }}>
                <b>{cancelTarget.bloodGroup}</b> — {cancelTarget.units} units. Accepted donors will be notified.
              </p>
              <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                <button type="button" onClick={() => setCancelTarget(null)} style={{ padding: "10px 15px", borderRadius: "6px", border: "1px solid #ccc", background: "white", cursor: "pointer", fontWeight: "bold" }}>No, Keep Request</button>
                <button type="button" onClick={confirmCancelRequest} style={{ padding: "10px 15px", borderRadius: "6px", border: "none", background: "#991b1b", color: "white", cursor: "pointer", fontWeight: "bold" }}>Yes, Cancel Request</button>
              </div>
            </div>
          </div>
        )}

        {/* EDIT REQUEST MODAL */}
        {editTarget && (
          <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
            <div style={{ background: "white", padding: "30px", borderRadius: "12px", width: "420px", boxShadow: "0 10px 25px rgba(0,0,0,0.2)" }}>
              <h3 style={{ marginTop: 0, color: "#1d3557" }}>✏️ Edit Request</h3>
              <p style={{ margin: "0 0 20px 0", color: "#666", fontSize: "14px" }}>Update units or urgency for <b>{editTarget.bloodGroup}</b> request.</p>
              <form onSubmit={submitEditRequest} style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
                <div>
                  <label style={{ fontWeight: "bold", color: "#555", display: "block", marginBottom: "5px" }}>Units Required</label>
                  <input type="number" min="1" value={editForm.units} onChange={e => setEditForm({ ...editForm, units: e.target.value })} required style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid #ccc", boxSizing: "border-box" }} />
                </div>
                <div>
                  <label style={{ fontWeight: "bold", color: "#555", display: "block", marginBottom: "5px" }}>Urgency Level</label>
                  <select value={editForm.urgency} onChange={e => setEditForm({ ...editForm, urgency: e.target.value })} style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid #ccc" }}>
                    <option value="normal">Normal</option>
                    <option value="urgent">Urgent</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
                <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                  <button type="button" onClick={() => setEditTarget(null)} style={{ padding: "10px 15px", borderRadius: "6px", border: "1px solid #ccc", background: "white", cursor: "pointer", fontWeight: "bold" }}>Cancel</button>
                  <button type="submit" style={{ padding: "10px 15px", borderRadius: "6px", border: "none", background: "#1d3557", color: "white", cursor: "pointer", fontWeight: "bold" }}>Save Changes</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* REPORT MODAL */}
        {reportTarget && (
          <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
            <div style={{ background: "white", padding: "30px", borderRadius: "12px", width: "400px", boxShadow: "0 10px 25px rgba(0,0,0,0.2)" }}>
              <h3 style={{ marginTop: 0, color: "#1d3557" }}>🚩 Report Donor</h3>
              <p style={{ margin: "5px 0 15px 0", color: "#666", fontSize: "14px" }}>
                Reporting <b>{reportTarget.name}</b>. This will be securely sent to the Admin.
              </p>
              <form onSubmit={handleReportUser}>
                <textarea
                  placeholder="Please describe why you are reporting this donor (e.g., Did not show up, Provided fake details...)"
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  required
                  style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid #ccc", minHeight: "100px", resize: "vertical", fontFamily: "inherit" }}
                />
                <div style={{ display: "flex", gap: "10px", marginTop: "20px", justifyContent: "flex-end" }}>
                  <button type="button" onClick={() => { setReportTarget(null); setReportReason(""); }} style={{ padding: "10px 15px", borderRadius: "6px", border: "1px solid #ccc", background: "white", cursor: "pointer", fontWeight: "bold" }}>Cancel</button>
                  <button type="submit" style={{ padding: "10px 15px", borderRadius: "6px", border: "none", background: "#e63946", color: "white", cursor: "pointer", fontWeight: "bold" }}>Submit Report</button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
      <style>{`
        @keyframes slideDown {
          from { transform: translateX(-50%) translateY(-20px); opacity: 0; }
          to   { transform: translateX(-50%) translateY(0);    opacity: 1; }
        }
      `}</style>
    </div>
  );
}