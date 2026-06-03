import axios from "axios";
import { useRouter } from "next/router";
import { useCallback, useEffect, useState } from "react";
import { io } from "socket.io-client";
import LiveChat from "../components/LiveChat";

const API = "http://localhost:5000/api/admin";
let socket = null;

function getToken() {
  return typeof window !== "undefined" ? localStorage.getItem("token") : null;
}

function authHeaders() {
  return { headers: { Authorization: `Bearer ${getToken()}` } };
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ icon, label, value, color, sub }) {
  return (
    <div style={{
      borderRadius: "18px",
      padding: "28px 24px",
      display: "flex",
      flexDirection: "column",
      gap: "10px",
      position: "relative",
      overflow: "hidden",
      backgroundColor: "#ffffff",
      boxShadow: `0 8px 30px rgba(0,0,0,0.03)`,
      transition: "transform 0.2s, box-shadow 0.2s",
      cursor: "default",
      border: "1px solid #e2e8f0"
    }}
      onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.boxShadow = `0 12px 40px rgba(0,0,0,0.06)`; }}
      onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = `0 8px 30px rgba(0,0,0,0.03)`; }}
    >
      <div style={{ position: "absolute", top: -20, right: -20, fontSize: "90px", opacity: 0.05 }}>{icon}</div>
      <div style={{ fontSize: "38px", fontWeight: "800", color, letterSpacing: "-1px" }}>{value ?? "—"}</div>
      <div style={{ fontSize: "13px", fontWeight: "700", color: "#64748b", textTransform: "uppercase", letterSpacing: "1px" }}>{label}</div>
      {sub && <div style={{ fontSize: "12px", color: "#94a3b8", marginTop: "2px", fontWeight: "500" }}>{sub}</div>}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "4px", background: `linear-gradient(90deg, ${color}, transparent)`, borderRadius: "0 0 18px 18px" }} />
    </div>
  );
}

// ─── Badge ────────────────────────────────────────────────────────────────────
function Badge({ label, color, bg }) {
  return (
    <span style={{
      display: "inline-block", padding: "4px 12px", borderRadius: "20px",
      fontSize: "11px", fontWeight: "700", letterSpacing: "0.5px",
      color: color || "#fff", backgroundColor: bg || "#000"
    }}>{label}</span>
  );
}

const urgencyColors = { critical: { bg: "#ffe4e6", color: "#e11d48" }, urgent: { bg: "#ffedd5", color: "#ea580c" }, normal: { bg: "#f1f5f9", color: "#3b82f6" } };
const statusColors = { open: { bg: "#dcfce7", color: "#16a34a" }, fulfilled: { bg: "#dbeafe", color: "#2563eb" }, completed: { bg: "#e0e7ff", color: "#4f46e5" }, expired: { bg: "#f1f5f9", color: "#64748b" }, pending: { bg: "#ffedd5", color: "#ea580c" }, resolved: { bg: "#dcfce7", color: "#16a34a" }, dismissed: { bg: "#f1f5f9", color: "#64748b" } };

// ─── Confirm Modal ────────────────────────────────────────────────────────────
function ConfirmModal({ message, onConfirm, onCancel }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0, 0, 0, 0.4)", backdropFilter: "blur(4px)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "#ffffff", borderRadius: "16px", padding: "32px", maxWidth: "380px", width: "90%", border: "1px solid #e2e8f0", boxShadow: "0 24px 60px rgba(0,0,0,0.1)" }}>
        <div style={{ fontSize: "24px", marginBottom: "12px" }}>⚠️</div>
        <p style={{ color: "#334155", marginBottom: "24px", lineHeight: 1.6, fontWeight: 500 }}>{message}</p>
        <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
          <button onClick={onCancel} style={ghostBtn}>Cancel</button>
          <button onClick={onConfirm} style={dangerBtn}>Confirm</button>
        </div>
      </div>
    </div>
  );
}

// ─── Resolve Report Modal ─────────────────────────────────────────────────────
function ResolveModal({ report, onClose, onSave }) {
  const initialStatus =
    report.status === "resolved" || report.status === "dismissed"
      ? report.status
      : "resolved";
  const [status, setStatus] = useState(initialStatus);
  const [notes, setNotes] = useState(report.adminNotes || "");

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "#ffffff", borderRadius: "16px", padding: "32px", maxWidth: "460px", width: "90%", border: "1px solid #e2e8f0", boxShadow: "0 24px 60px rgba(0,0,0,0.1)" }}>
        <h3 style={{ color: "#0f172a", marginBottom: "20px", fontSize: "18px", fontWeight: "800" }}>📋 Resolve Report</h3>
        <div style={{ marginBottom: "16px" }}>
          <label style={labelStyle}>Status</label>
          <select value={status} onChange={e => setStatus(e.target.value)} style={inputStyle}>
            <option value="resolved">Resolved</option>
            <option value="dismissed">Dismissed</option>
          </select>
        </div>
        <div style={{ marginBottom: "24px" }}>
          <label style={labelStyle}>Admin Notes</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={4} placeholder="Add your notes..." style={{ ...inputStyle, resize: "vertical" }} />
        </div>
        <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
          <button onClick={onClose} style={ghostBtn}>Cancel</button>
          <button onClick={() => onSave(report._id, status, notes)} style={primaryBtn}>Save</button>
        </div>
      </div>
    </div>
  );
}

// ─── Shared Styles ────────────────────────────────────────────────────────────
const primaryBtn = { padding: "9px 22px", borderRadius: "10px", border: "none", cursor: "pointer", background: "linear-gradient(135deg, #e11d48, #be123c)", color: "#fff", fontWeight: "700", fontSize: "13px", transition: "opacity 0.2s", boxShadow: "0 4px 12px rgba(225, 29, 72, 0.2)" };
const dangerBtn = { padding: "9px 22px", borderRadius: "10px", border: "none", cursor: "pointer", background: "#ef4444", color: "#fff", fontWeight: "700", fontSize: "13px" };
const ghostBtn = { padding: "9px 22px", borderRadius: "10px", border: "1px solid #cbd5e1", cursor: "pointer", background: "#f8fafc", color: "#475569", fontWeight: "600", fontSize: "13px" };
const inputStyle = { width: "100%", padding: "10px 14px", borderRadius: "10px", border: "1px solid #cbd5e1", background: "#f8fafc", color: "#0f172a", fontSize: "14px", boxSizing: "border-box", outline: "none", transition: "border-color 0.2s" };
const labelStyle = { display: "block", color: "#64748b", fontSize: "12px", fontWeight: "700", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.5px" };

const tableHeaderStyle = { color: "#64748b", fontSize: "12px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.5px", padding: "16px 20px", textAlign: "left", borderBottom: "2px solid #e2e8f0", whiteSpace: "nowrap", background: "#f8fafc" };
const tableCellStyle = { padding: "16px 20px", color: "#334155", fontSize: "14px", borderBottom: "1px solid #f1f5f9", verticalAlign: "middle" };

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("analytics");
  const [analytics, setAnalytics] = useState(null);
  const [users, setUsers] = useState([]);
  const [requests, setRequests] = useState([]);
  const [reports, setReports] = useState([]);
  const [pendingReportCount, setPendingReportCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [resolveTarget, setResolveTarget] = useState(null);
  const [chatRecipient, setChatRecipient] = useState(null);
  const [messageUnread, setMessageUnread] = useState(0);
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  // ── Auth guard
  useEffect(() => {
    if (typeof window === "undefined") return;
    
    const role = localStorage.getItem("role");
    if (role !== "admin") {
      router.push("/login");
    }
  }, [router]);

  // ── Toast helper
  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // ── Fetchers
  const fetchAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API}/analytics`, authHeaders());
      setAnalytics(res.data);
    } catch { showToast("Failed to load analytics", "error"); }
    finally { setLoading(false); }
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API}/users`, authHeaders());
      setUsers(res.data);
    } catch { showToast("Failed to load users", "error"); }
    finally { setLoading(false); }
  }, []);

  const fetchRequests = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API}/requests`, authHeaders());
      setRequests(res.data);
    } catch { showToast("Failed to load requests", "error"); }
    finally { setLoading(false); }
  }, []);

  const fetchReports = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API}/reports`, authHeaders());
      setReports(res.data);
      setPendingReportCount(res.data.filter((r) => r.status === "pending").length);
    } catch { showToast("Failed to load reports", "error"); }
    finally { setLoading(false); }
  }, []);

  // ── Socket: live new reports from donors/hospitals
  useEffect(() => {
    if (typeof window === "undefined") return;
    
    const token = getToken();
    if (!token) return;
    
    if (!socket) {
      socket = io("http://localhost:5000");
    }
    
    socket.emit("join", token);

    socket.on("new-report", (data) => {
      const reporter = data.report?.reportedBy?.name || "A user";
      const target = data.report?.targetId?.name || "someone";
      showToast(`New report: ${reporter} reported ${target}`, "error");
      fetchReports();
    });

    return () => socket.off("new-report");
  }, [fetchReports]);

  // Load pending report count on mount
  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  // ── Tab change
  useEffect(() => {
    if (activeTab === "analytics") fetchAnalytics();
    else if (activeTab === "users") fetchUsers();
    else if (activeTab === "requests") fetchRequests();
    else if (activeTab === "reports") fetchReports();
  }, [activeTab]);

  // ── Actions
  const handleBlock = (user) => {
    setConfirm({
      message: `Are you sure you want to ${user.isBlocked ? "unblock" : "block"} ${user.name}?`,
      onConfirm: async () => {
        setConfirm(null);
        try {
          await axios.put(`${API}/users/${user._id}/block`, {}, authHeaders());
          showToast(`User ${user.isBlocked ? "unblocked" : "blocked"} successfully`);
          fetchUsers();
        } catch { showToast("Action failed", "error"); }
      }
    });
  };

  const handleVerify = async (user) => {
    try {
      await axios.put(`${API}/users/${user._id}/verify`, {}, authHeaders());
      showToast(`Hospital ${user.isVerified ? "unverified" : "verified"} successfully`);
      fetchUsers();
    } catch { showToast("Action failed", "error"); }
  };

  const handleDeleteRequest = (req) => {
    setConfirm({
      message: `Permanently delete this blood request for ${req.bloodGroup}? This cannot be undone.`,
      onConfirm: async () => {
        setConfirm(null);
        try {
          await axios.delete(`${API}/requests/${req._id}`, authHeaders());
          showToast("Request deleted");
          fetchRequests();
        } catch { showToast("Delete failed", "error"); }
      }
    });
  };

  const handleResolveReport = async (id, status, notes) => {
    if (!["resolved", "dismissed"].includes(status)) {
      showToast("Please choose Resolved or Dismissed", "error");
      return;
    }
    try {
      await axios.put(`${API}/reports/${id}/resolve`, { status, adminNotes: notes }, authHeaders());
      showToast("Report updated successfully");
      setResolveTarget(null);
      fetchReports();
    } catch (err) {
      showToast(err.response?.data?.message || "Failed to update report", "error");
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    router.push("/login");
  };

  // ── Filtered lists
  const filteredUsers = users.filter(u => {
    const matchSearch = u.name?.toLowerCase().includes(search.toLowerCase()) || u.email?.toLowerCase().includes(search.toLowerCase());
    const matchRole = filterRole === "all" || u.role === filterRole;
    return matchSearch && matchRole;
  });

  const filteredRequests = requests.filter(r => {
    const matchSearch = r.bloodGroup?.toLowerCase().includes(search.toLowerCase()) || r.hospitalId?.name?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === "all" || r.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const filteredReports = reports.filter(r => {
    const matchSearch = r.reportedBy?.name?.toLowerCase().includes(search.toLowerCase()) || r.reason?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === "all" || r.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const tabs = [
    { id: "analytics", label: "Analytics", icon: "📊" },
    { id: "users", label: "Users & Hospitals", icon: "👥" },
    { id: "requests", label: "Blood Requests", icon: "🩸" },
    { id: "reports", label: `Reports${pendingReportCount > 0 ? ` (${pendingReportCount})` : ""}`, icon: "🚨" },
    { id: "messages", label: `Messages${messageUnread > 0 ? ` (${messageUnread})` : ""}`, icon: "💬" },
  ];

  const bloodGroupColors = {
    "A+": "#ef4444", "A-": "#f97316", "B+": "#eab308", "B-": "#84cc16",
    "O+": "#0ea5e9", "O-": "#3b82f6", "AB+": "#8b5cf6", "AB-": "#ec4899",
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", fontFamily: "'Inter', system-ui, sans-serif", color: "#334155" }}>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />

      {/* ── Top Nav */}
      <nav style={{ padding: "0 32px", height: "64px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(255,255,255,0.8)", backdropFilter: "blur(12px)", borderBottom: "1px solid #e2e8f0", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "linear-gradient(135deg,#e11d48,#be123c)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px" }}>🩸</div>
          <div>
            <div style={{ fontWeight: "800", fontSize: "16px", color: "#0f172a", letterSpacing: "-0.3px" }}>BloodLink</div>
            <div style={{ fontSize: "10px", color: "#e11d48", fontWeight: "700", textTransform: "uppercase", letterSpacing: "1px" }}>Admin Console</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: "linear-gradient(135deg,#e11d48,#7c3aed)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px", fontWeight: "800", color: "#fff" }}>A</div>
          <div style={{ fontSize: "13px" }}>
            <div style={{ fontWeight: "700", color: "#0f172a" }}>Administrator</div>
            <div style={{ color: "#64748b", fontSize: "11px", fontWeight: "500" }}>Super Admin</div>
          </div>
          <button onClick={handleLogout} style={{ padding: "8px 18px", borderRadius: "10px", border: "1px solid #cbd5e1", background: "transparent", color: "#475569", cursor: "pointer", fontSize: "13px", fontWeight: "600", transition: "all 0.2s" }}
            onMouseEnter={e => { e.currentTarget.style.background = "#f1f5f9"; e.currentTarget.style.color = "#0f172a"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#475569"; }}>
            Logout
          </button>
        </div>
      </nav>

      <div style={{ maxWidth: "1400px", margin: "0 auto", padding: "32px 24px" }}>

        {/* ── Page Title */}
        <div style={{ marginBottom: "32px" }}>
          <h1 style={{ fontSize: "32px", fontWeight: "900", background: "linear-gradient(135deg,#0f172a,#475569)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", margin: 0, letterSpacing: "-1px" }}>Admin Dashboard</h1>
          <p style={{ color: "#64748b", fontSize: "14px", marginTop: "6px", fontWeight: "500" }}>Manage users, monitor requests, and resolve reports</p>
        </div>

        {/* ── Tab Bar */}
        <div style={{ display: "flex", gap: "6px", marginBottom: "32px", background: "#ffffff", padding: "6px", borderRadius: "14px", border: "1px solid #e2e8f0", boxShadow: "0 4px 6px rgba(0,0,0,0.02)", width: "fit-content" }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => { setActiveTab(t.id); setSearch(""); setFilterRole("all"); setFilterStatus("all"); if (t.id !== "messages") setChatRecipient(null); }}
              style={{
                padding: "10px 20px", borderRadius: "10px", border: "none", cursor: "pointer", fontWeight: "700", fontSize: "13px", transition: "all 0.2s", display: "flex", alignItems: "center", gap: "7px",
                background: activeTab === t.id ? "linear-gradient(135deg,#e11d48,#be123c)" : "transparent",
                color: activeTab === t.id ? "#fff" : "#64748b",
                boxShadow: activeTab === t.id ? "0 4px 16px rgba(225,29,72,0.3)" : "none",
              }}
              onMouseEnter={e => { if (activeTab !== t.id) e.currentTarget.style.color = "#0f172a"; }}
              onMouseLeave={e => { if (activeTab !== t.id) e.currentTarget.style.color = "#64748b"; }}>
              <span>{t.icon}</span>{t.label}
            </button>
          ))}
        </div>

        {/* ───────── ANALYTICS TAB ───────── */}
        {activeTab === "analytics" && (
          <div>
            {loading ? <Spinner /> : analytics && (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "20px", marginBottom: "32px" }}>
                  <StatCard icon="🧑‍🤝‍🧑" label="Total Donors" value={analytics.totalDonors} color="#e11d48" sub="Registered blood donors" />
                  <StatCard icon="🏥" label="Total Hospitals" value={analytics.totalHospitals} color="#3b82f6" sub="Registered hospitals" />
                  <StatCard icon="📋" label="Total Requests" value={analytics.totalRequests} color="#8b5cf6" sub="All blood requests" />
                  <StatCard icon="✅" label="Completed" value={analytics.completedRequests} color="#10b981" sub="Fulfilled or completed" />
                  <StatCard icon="🩸" label="Most Requested" value={analytics.mostRequestedBloodGroup || "—"} color={bloodGroupColors[analytics.mostRequestedBloodGroup] || "#e11d48"} sub="Blood group in highest demand" />
                </div>

                {/* Progress bars */}
                <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "18px", padding: "28px", boxShadow: "0 4px 12px rgba(0,0,0,0.03)" }}>
                  <h3 style={{ color: "#0f172a", fontSize: "16px", fontWeight: "800", marginBottom: "24px" }}>📈 Request Completion Rate</h3>
                  <div style={{ marginBottom: "20px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                      <span style={{ color: "#64748b", fontSize: "13px", fontWeight: "600" }}>Completed / Total Requests</span>
                      <span style={{ color: "#10b981", fontWeight: "800", fontSize: "14px" }}>
                        {analytics.totalRequests > 0 ? Math.round((analytics.completedRequests / analytics.totalRequests) * 100) : 0}%
                      </span>
                    </div>
                    <div style={{ height: "10px", background: "#f1f5f9", borderRadius: "99px", overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${analytics.totalRequests > 0 ? (analytics.completedRequests / analytics.totalRequests) * 100 : 0}%`, background: "linear-gradient(90deg,#10b981,#059669)", borderRadius: "99px", transition: "width 1s ease" }} />
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginTop: "24px" }}>
                    {[
                      { label: "Pending / Open", val: analytics.totalRequests - analytics.completedRequests, color: "#ea580c", bg: "#ffedd5" },
                      { label: "Hospitals vs Donors", val: `${analytics.totalHospitals} : ${analytics.totalDonors}`, color: "#2563eb", bg: "#dbeafe" },
                    ].map((item, i) => (
                      <div key={i} style={{ background: item.bg, borderRadius: "12px", padding: "18px", border: "1px solid transparent" }}>
                        <div style={{ color: item.color, fontSize: "12px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "8px", opacity: 0.8 }}>{item.label}</div>
                        <div style={{ color: item.color, fontSize: "28px", fontWeight: "900" }}>{item.val}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ───────── USERS TAB ───────── */}
        {activeTab === "users" && (
          <div>
            {/* Filters */}
            <div style={{ display: "flex", gap: "12px", marginBottom: "20px", flexWrap: "wrap" }}>
              <input placeholder="🔍  Search by name or email..." value={search} onChange={e => setSearch(e.target.value)} style={{ ...inputStyle, maxWidth: "320px" }} />
              <select value={filterRole} onChange={e => setFilterRole(e.target.value)} style={{ ...inputStyle, width: "160px" }}>
                <option value="all">All Roles</option>
                <option value="donor">Donors</option>
                <option value="hospital">Hospitals</option>
              </select>
              <button onClick={fetchUsers} style={{ ...ghostBtn }}>🔄 Refresh</button>
            </div>

            <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "18px", overflow: "hidden", boxShadow: "0 4px 12px rgba(0,0,0,0.03)" }}>
              {loading ? <Spinner /> : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr>
                        {["User", "Email", "Role", "Blood Group", "Status", "Actions"].map(h => (
                          <th key={h} style={tableHeaderStyle}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.length === 0 ? (
                        <tr><td colSpan={6} style={{ ...tableCellStyle, textAlign: "center", color: "#64748b", padding: "48px", fontWeight: "500" }}>No users found</td></tr>
                      ) : filteredUsers.map(u => (
                        <tr key={u._id} style={{ transition: "background 0.15s" }}
                          onMouseEnter={e => e.currentTarget.style.background = "#f8fafc"}
                          onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                          <td style={tableCellStyle}>
                            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                              <div style={{ width: "38px", height: "38px", borderRadius: "50%", background: u.role === "hospital" ? "linear-gradient(135deg,#3b82f6,#1d4ed8)" : "linear-gradient(135deg,#e11d48,#be123c)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px", fontWeight: "800", color: "#fff", flexShrink: 0 }}>
                                {u.role === "hospital" ? "🏥" : u.name?.[0]?.toUpperCase()}
                              </div>
                              <div>
                                <div style={{ fontWeight: "700", color: "#0f172a" }}>{u.name}</div>
                                <div style={{ fontSize: "12px", color: "#64748b", fontWeight: "500" }}>{u.phone || "—"}</div>
                              </div>
                            </div>
                          </td>
                          <td style={{ ...tableCellStyle, color: "#475569", fontWeight: "500" }}>{u.email}</td>
                          <td style={tableCellStyle}><Badge label={u.role.toUpperCase()} bg={u.role === "hospital" ? "#dbeafe" : "#f3e8ff"} color={u.role === "hospital" ? "#2563eb" : "#9333ea"} /></td>
                          <td style={tableCellStyle}>
                            {u.bloodGroup ? <span style={{ fontWeight: "800", color: bloodGroupColors[u.bloodGroup] || "#e11d48", fontSize: "15px" }}>{u.bloodGroup}</span> : <span style={{ color: "#94a3b8", fontWeight: "600" }}>—</span>}
                          </td>
                          <td style={tableCellStyle}>
                            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                              {u.isBlocked && <Badge label="BLOCKED" bg="#fee2e2" color="#b91c1c" />}
                              {u.role === "hospital" && <Badge label={u.isVerified ? "VERIFIED" : "UNVERIFIED"} bg={u.isVerified ? "#dcfce7" : "#ffedd5"} color={u.isVerified ? "#16a34a" : "#ea580c"} />}
                              {!u.isBlocked && u.role === "donor" && <Badge label={u.availability?.toUpperCase() || "AVAILABLE"} bg="#f1f5f9" color="#3b82f6" />}
                            </div>
                          </td>
                          <td style={tableCellStyle}>
                            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                              {u.role === "hospital" && !u.isVerified && (
                                <button onClick={() => handleVerify(u)} style={{ padding: "6px 14px", borderRadius: "8px", border: "1px solid transparent", cursor: "pointer", fontSize: "12px", fontWeight: "700", background: "linear-gradient(135deg,#16a34a,#15803d)", color: "#fff", transition: "all 0.2s" }}>
                                  ✔ Verify
                                </button>
                              )}
                              <button
                                onClick={() => {
                                  setActiveTab("messages");
                                  setChatRecipient({ _id: u._id, name: u.name, role: u.role });
                                }}
                                style={{ padding: "6px 14px", borderRadius: "8px", border: "1px solid #cbd5e1", cursor: "pointer", fontSize: "12px", fontWeight: "700", background: "#eff6ff", color: "#2563eb" }}
                              >
                                💬 Message
                              </button>
                              <button onClick={() => handleBlock(u)} style={{ padding: "6px 14px", borderRadius: "8px", border: "1px solid transparent", cursor: "pointer", fontSize: "12px", fontWeight: "700", background: u.isBlocked ? "#f1f5f9" : "#fee2e2", color: u.isBlocked ? "#64748b" : "#b91c1c", transition: "all 0.2s" }}>
                                {u.isBlocked ? "Unblock" : "Block"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div style={{ color: "#64748b", fontSize: "12px", marginTop: "12px", fontWeight: "600" }}>Showing {filteredUsers.length} of {users.length} users</div>
          </div>
        )}

        {/* ───────── REQUESTS TAB ───────── */}
        {activeTab === "requests" && (
          <div>
            <div style={{ display: "flex", gap: "12px", marginBottom: "20px", flexWrap: "wrap" }}>
              <input placeholder="🔍  Search by blood group or hospital..." value={search} onChange={e => setSearch(e.target.value)} style={{ ...inputStyle, maxWidth: "320px" }} />
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ ...inputStyle, width: "160px" }}>
                <option value="all">All Statuses</option>
                <option value="open">Open</option>
                <option value="fulfilled">Fulfilled</option>
                <option value="completed">Completed</option>
                <option value="expired">Expired</option>
              </select>
              <button onClick={fetchRequests} style={ghostBtn}>🔄 Refresh</button>
            </div>

            <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "18px", overflow: "hidden", boxShadow: "0 4px 12px rgba(0,0,0,0.03)" }}>
              {loading ? <Spinner /> : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr>
                        {["Hospital", "Blood Group", "Units", "Urgency", "Location", "Status", "Donors", "Expires", "Actions"].map(h => (
                          <th key={h} style={tableHeaderStyle}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRequests.length === 0 ? (
                        <tr><td colSpan={9} style={{ ...tableCellStyle, textAlign: "center", color: "#64748b", padding: "48px", fontWeight: "500" }}>No requests found</td></tr>
                      ) : filteredRequests.map(r => (
                        <tr key={r._id} style={{ transition: "background 0.15s" }}
                          onMouseEnter={e => e.currentTarget.style.background = "#f8fafc"}
                          onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                          <td style={tableCellStyle}>
                            <div style={{ fontWeight: "700", color: "#0f172a" }}>{r.hospitalId?.name || "Unknown"}</div>
                            <div style={{ fontSize: "11px", color: "#64748b", fontWeight: "500" }}>{r.hospitalId?.email || ""}</div>
                          </td>
                          <td style={tableCellStyle}><span style={{ fontWeight: "900", color: bloodGroupColors[r.bloodGroup] || "#e11d48", fontSize: "18px" }}>{r.bloodGroup}</span></td>
                          <td style={{ ...tableCellStyle, fontWeight: "800", color: "#0f172a" }}>{r.units} u</td>
                          <td style={tableCellStyle}><Badge label={r.urgency?.toUpperCase()} {...(urgencyColors[r.urgency] || {})} /></td>
                          <td style={{ ...tableCellStyle, color: "#475569", fontSize: "13px", fontWeight: "500" }}>{r.location?.city || "—"}</td>
                          <td style={tableCellStyle}><Badge label={r.status?.toUpperCase()} {...(statusColors[r.status] || {})} /></td>
                          <td style={{ ...tableCellStyle, fontWeight: "800", color: "#2563eb" }}>{r.acceptedDonors?.length ?? 0}</td>
                          <td style={{ ...tableCellStyle, color: "#64748b", fontSize: "12px", fontWeight: "500" }}>{r.expiresAt ? new Date(r.expiresAt).toLocaleDateString() : "—"}</td>
                          <td style={tableCellStyle}>
                            <button onClick={() => handleDeleteRequest(r)} style={{ padding: "6px 14px", borderRadius: "8px", border: "none", cursor: "pointer", fontSize: "12px", fontWeight: "700", background: "#fee2e2", color: "#b91c1c" }}>Delete</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div style={{ color: "#64748b", fontSize: "12px", marginTop: "12px", fontWeight: "600" }}>Showing {filteredRequests.length} of {requests.length} requests</div>
          </div>
        )}

        {/* ───────── MESSAGES TAB ───────── */}
        {activeTab === "messages" && (
          <div>
            <p style={{ color: "#64748b", fontSize: "14px", marginBottom: "16px", fontWeight: "500" }}>
              Live chat with any donor or hospital. You can also message users from the Users tab.
            </p>
            <LiveChat
              socket={socket}
              theme="admin"
              initialRecipient={chatRecipient}
              onUnreadChange={setMessageUnread}
            />
          </div>
        )}

        {/* ───────── REPORTS TAB ───────── */}
        {activeTab === "reports" && (
          <div>
            <div style={{ display: "flex", gap: "12px", marginBottom: "20px", flexWrap: "wrap" }}>
              <input placeholder="🔍  Search by reporter or reason..." value={search} onChange={e => setSearch(e.target.value)} style={{ ...inputStyle, maxWidth: "320px" }} />
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ ...inputStyle, width: "160px" }}>
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="resolved">Resolved</option>
                <option value="dismissed">Dismissed</option>
              </select>
              <button onClick={fetchReports} style={ghostBtn}>🔄 Refresh</button>
            </div>

            {/* Pending badge summary */}
            <div style={{ display: "flex", gap: "12px", marginBottom: "20px" }}>
              {["pending", "resolved", "dismissed"].map(s => {
                const count = reports.filter(r => r.status === s).length;
                return count > 0 ? (
                  <div key={s} onClick={() => setFilterStatus(s)} style={{ padding: "8px 18px", borderRadius: "10px", cursor: "pointer", border: `1px solid ${statusColors[s]?.color}33`, background: statusColors[s]?.bg, color: statusColors[s]?.color, fontSize: "13px", fontWeight: "700", transition: "transform 0.1s" }}
                    onMouseEnter={e => e.currentTarget.style.transform = "scale(1.05)"}
                    onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}>
                    {s.charAt(0).toUpperCase() + s.slice(1)}: {count}
                  </div>
                ) : null;
              })}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {loading ? <Spinner /> : filteredReports.length === 0 ? (
                <div style={{ textAlign: "center", color: "#64748b", padding: "64px", background: "#ffffff", borderRadius: "18px", border: "1px dashed #cbd5e1" }}>
                  <div style={{ fontSize: "48px", marginBottom: "12px" }}>✅</div>
                  <div style={{ fontWeight: "600", fontSize: "16px" }}>No reports found</div>
                </div>
              ) : filteredReports.map(r => (
                <div key={r._id} style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "16px", padding: "24px", transition: "border-color 0.2s, box-shadow 0.2s", boxShadow: "0 4px 12px rgba(0,0,0,0.02)" }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = "#cbd5e1"; e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,0.05)"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = "#e2e8f0"; e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.02)"; }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px", flexWrap: "wrap" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px", flexWrap: "wrap" }}>
                        <Badge label={r.status?.toUpperCase()} {...(statusColors[r.status] || {})} />
                        <span style={{ color: "#64748b", fontSize: "12px", fontWeight: "600" }}>{new Date(r.createdAt).toLocaleDateString()}</span>
                      </div>
                      <p style={{ color: "#0f172a", margin: "0 0 12px", fontSize: "15px", fontWeight: "600" }}>{r.reason}</p>
                      <div style={{ marginBottom: "12px" }}>
                        <Badge
                          label={
                            r.reporterRole === "donor"
                              ? "DONOR → HOSPITAL"
                              : r.reporterRole === "hospital"
                              ? "HOSPITAL → DONOR"
                              : "USER REPORT"
                          }
                          bg="#e0e7ff"
                          color="#4338ca"
                        />
                      </div>
                      <div style={{ display: "flex", gap: "24px", flexWrap: "wrap" }}>
                        <div>
                          <div style={labelStyle}>Reported By</div>
                          <div style={{ color: "#334155", fontSize: "13px", fontWeight: "700" }}>{r.reportedBy?.name || "—"} <span style={{ color: "#64748b", fontWeight: "500" }}>({r.reportedBy?.role} · {r.reportedBy?.email})</span></div>
                        </div>
                        <div>
                          <div style={labelStyle}>Against</div>
                          <div style={{ color: "#334155", fontSize: "13px", fontWeight: "700" }}>{r.targetId?.name || "—"} <span style={{ color: "#64748b", fontWeight: "500" }}>({r.targetId?.role} · {r.targetId?.email})</span></div>
                        </div>
                      </div>
                      {r.adminNotes && (
                        <div style={{ marginTop: "16px", padding: "12px 16px", background: "#f8fafc", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
                          <div style={labelStyle}>Admin Notes</div>
                          <div style={{ color: "#334155", fontSize: "14px", fontWeight: "500", fontStyle: "italic" }}>"{r.adminNotes}"</div>
                        </div>
                      )}
                    </div>
                    {r.status === "pending" && (
                      <button onClick={() => setResolveTarget(r)} style={primaryBtn}>📋 Resolve</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Modals */}
      {confirm && <ConfirmModal message={confirm.message} onConfirm={confirm.onConfirm} onCancel={() => setConfirm(null)} />}
      {resolveTarget && <ResolveModal report={resolveTarget} onClose={() => setResolveTarget(null)} onSave={handleResolveReport} />}

      {/* ── Toast */}
      {toast && (
        <div style={{ position: "fixed", bottom: "28px", right: "28px", padding: "14px 24px", borderRadius: "12px", background: toast.type === "error" ? "#fee2e2" : "#dcfce7", border: `1px solid ${toast.type === "error" ? "#f87171" : "#4ade80"}`, color: toast.type === "error" ? "#b91c1c" : "#15803d", fontWeight: "800", fontSize: "14px", boxShadow: "0 8px 32px rgba(0,0,0,0.1)", zIndex: 2000, display: "flex", alignItems: "center", gap: "10px", animation: "slideIn 0.3s ease" }}>
          {toast.type === "error" ? "❌" : "✅"} {toast.msg}
        </div>
      )}

      <style>{`
        @keyframes slideIn { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes spin { to { transform: rotate(360deg); } }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: #f8fafc; }
        ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
        select option { background: #ffffff; color: #0f172a; }
      `}</style>
    </div>
  );
}

function Spinner() {
  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", padding: "64px", gap: "14px" }}>
      <div style={{ width: "28px", height: "28px", border: "3px solid #e2e8f0", borderTop: "3px solid #e11d48", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <span style={{ color: "#64748b", fontSize: "14px", fontWeight: "600" }}>Loading data...</span>
    </div>
  );
}