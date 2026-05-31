import axios from "axios";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";

export default function DonationHistoryPage() {
  const router = useRouter();
  const [userProfile, setUserProfile] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [availability, setAvailability] = useState("available");
  const [eligibility, setEligibility] = useState({ eligible: true, remainingDays: 0 });

  const getStatusColor = (status) => {
    const s = status || availability;
    if (s === "available") return "#10b981";
    if (s === "busy") return "#f59e0b";
    return "#64748b";
  };

  const fetchHistoryAndProfile = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        router.push("/login");
        return;
      }

      // Fetch user profile info
      const profileRes = await axios.get("http://localhost:5000/api/user/profile", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUserProfile(profileRes.data);
      setAvailability(profileRes.data.availability);

      // Fetch donation history list from GET /api/donor/history
      const historyRes = await axios.get("http://localhost:5000/api/donor/history", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setHistory(historyRes.data);

      // Calculate eligibility details
      let eligible = true;
      let remainingDays = 0;
      if (profileRes.data.lastDonationDate) {
        const diff = (new Date() - new Date(profileRes.data.lastDonationDate)) / (1000 * 60 * 60 * 24);
        if (diff < 90) {
          eligible = false;
          remainingDays = Math.ceil(90 - diff);
        }
      }
      setEligibility({ eligible, remainingDays });

    } catch (err) {
      console.error("Failed to load history data", err);
      router.push("/login");
    } finally {
      setLoading(false);
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
    } catch (err) {
      alert("Failed to update availability");
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    window.location.href = "/login";
  };

  useEffect(() => {
    fetchHistoryAndProfile();
  }, []);

  if (loading || !userProfile) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", justifyContent: "center", alignItems: "center", background: "#f8fafc", fontFamily: "'Inter', sans-serif" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
          <div style={{ width: "40px", height: "40px", border: "4px solid #cbd5e1", borderTop: "4px solid #e63946", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
          <span style={{ color: "#64748b", fontWeight: "600", fontSize: "15px" }}>Loading history...</span>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f8fafc", fontFamily: "'Inter', system-ui, sans-serif", display: "flex", color: "#334155" }}>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet" />

      {/* SIDEBAR */}
      <aside style={{
        width: "280px", backgroundColor: "#ffffff", borderRight: "1px solid #e2e8f0",
        display: "flex", flexDirection: "column", padding: "28px 20px", flexShrink: 0,
        position: "sticky", top: 0, height: "100vh", boxSizing: "border-box"
      }}>
        {/* BRANDING */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "36px", paddingLeft: "8px" }}>
          <span style={{ fontSize: "28px" }}>🩸</span>
          <div>
            <span style={{ fontSize: "18px", fontWeight: "900", color: "#0f172a", letterSpacing: "-0.5px" }}>HemoLink</span>
            <div style={{ fontSize: "10px", color: "#e63946", fontWeight: "800", textTransform: "uppercase", letterSpacing: "1.5px", marginTop: "-2px" }}>Donor Hub</div>
          </div>
        </div>

        {/* PROFILE MINI-CARD & AVAILABILITY STATE SELECTOR */}
        <div style={{
          backgroundColor: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "16px",
          padding: "16px", marginBottom: "32px", display: "flex", flexDirection: "column", gap: "14px"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{
              width: "48px", height: "48px", borderRadius: "50%",
              backgroundColor: "#fee2e2", border: "2px solid #fff",
              display: "flex", alignItems: "center", justifyItems: "center",
              justifyContent: "center", fontSize: "24px", overflow: "hidden",
              boxShadow: "0 4px 10px rgba(230,57,70,0.1)"
            }}>
              {userProfile.profilePhoto ? (
                userProfile.profilePhoto.length <= 4 ? (
                  <span>{userProfile.profilePhoto}</span>
                ) : (
                  <img src={userProfile.profilePhoto} alt="Profile" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                )
              ) : (
                <span style={{ color: "#e63946", fontWeight: "800", fontSize: "18px" }}>
                  {(userProfile.name || "").charAt(0).toUpperCase()}
                </span>
              )}
            </div>

            <div style={{ flex: 1, overflow: "hidden" }}>
              <div style={{ fontWeight: "700", color: "#0f172a", fontSize: "14px", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                {userProfile.name}
              </div>
              <div style={{ display: "flex", gap: "6px", alignItems: "center", marginTop: "3px" }}>
                <span style={{ fontSize: "11px", fontWeight: "800", color: "#e63946", backgroundColor: "#fff5f5", padding: "1px 6px", borderRadius: "6px", border: "1px solid #fed7aa" }}>
                  {userProfile.bloodGroup || "Bg?"}
                </span>
                <span style={{ fontSize: "11px", color: "#64748b", fontWeight: "500" }}>Donor</span>
              </div>
            </div>
          </div>

          <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: "12px" }}>
            <label style={{ fontSize: "10px", fontWeight: "800", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px", display: "block", marginBottom: "8px" }}>
              Availability Status
            </label>
            <div style={{ display: "flex", borderRadius: "10px", background: "#cbd5e144", padding: "3px", gap: "2px" }}>
              {["available", "busy", "offline"].map((statusOption) => {
                const active = availability === statusOption;
                return (
                  <button
                    key={statusOption}
                    onClick={() => updateAvailabilityState(statusOption)}
                    style={{
                      flex: 1, border: "none", borderRadius: "8px", padding: "6px 2px",
                      fontSize: "10px", fontWeight: "700", cursor: "pointer",
                      textTransform: "capitalize", transition: "all 0.2s",
                      backgroundColor: active ? getStatusColor(statusOption) : "transparent",
                      color: active ? "#ffffff" : "#475569",
                      boxShadow: active ? "0 2px 6px rgba(0,0,0,0.06)" : "none"
                    }}
                  >
                    {statusOption}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* NAVIGATION ITEMS */}
        <nav style={{ display: "flex", flexDirection: "column", gap: "6px", flex: 1 }}>
          {[
            { id: "requests", label: "Emergency Feed", icon: "📢", path: "/donorDashboard" },
            { id: "messages", label: "Messages", icon: "💬", path: "/donorDashboard?tab=messages" },
            { id: "profile", label: "Donation History", icon: "⏳", path: "/history" },
            { id: "settings", label: "Profile Settings", icon: "⚙️", path: "/profile" },
            { id: "reports", label: "My Reports", icon: "🚨", path: "/donorDashboard?tab=reports" },
          ].map((item) => {
            const active = item.id === "profile";
            return (
              <button
                key={item.id}
                onClick={() => router.push(item.path)}
                style={{
                  display: "flex", alignItems: "center", gap: "12px", width: "100%",
                  border: "none", borderRadius: "12px", padding: "12px 14px",
                  cursor: "pointer", transition: "all 0.2s", textAlign: "left",
                  backgroundColor: active ? "rgba(230,57,70,0.06)" : "transparent",
                  color: active ? "#e63946" : "#475569",
                  fontWeight: active ? "700" : "600",
                  fontSize: "14px"
                }}
              >
                <span style={{ fontSize: "16px" }}>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* LOGOUT */}
        <button
          onClick={handleLogout}
          style={{
            display: "flex", alignItems: "center", gap: "12px", width: "100%",
            border: "1px solid #fee2e2", borderRadius: "12px", padding: "12px 14px",
            cursor: "pointer", transition: "all 0.2s", textAlign: "left",
            backgroundColor: "#fff5f5", color: "#ef4444", fontWeight: "700", fontSize: "14px",
            marginTop: "auto"
          }}
        >
          <span>🚪</span>
          <span>Logout</span>
        </button>
      </aside>

      {/* MAIN CONTAINER */}
      <main style={{ flex: 1, padding: "40px", boxSizing: "border-box", overflowY: "auto", height: "100vh" }}>
        
        <header style={{ marginBottom: "36px" }}>
          <h1 style={{ margin: 0, fontSize: "28px", fontWeight: "800", color: "#0f172a", letterSpacing: "-0.8px" }}>
            Hero's Log & Donation History
          </h1>
          <p style={{ margin: "4px 0 0 0", color: "#64748b", fontSize: "14px" }}>
            Review your donation records, total lives saved impact stats, and eligibility checks.
          </p>
        </header>

        {/* Impact Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "20px", marginBottom: "36px" }}>
          <div style={{ backgroundColor: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "18px", padding: "24px", display: "flex", flexDirection: "column", gap: "8px", position: "relative" }}>
            <span style={{ fontSize: "36px", position: "absolute", top: "18px", right: "18px" }}>🩺</span>
            <span style={{ fontSize: "13px", fontWeight: "700", color: "#64748b", textTransform: "uppercase" }}>Total Donations</span>
            <span style={{ fontSize: "32px", fontWeight: "900", color: "#0f172a" }}>
              {history.length}
            </span>
            <span style={{ fontSize: "12px", color: "#94a3b8", fontWeight: "500" }}>Verified check-ins</span>
          </div>

          <div style={{ backgroundColor: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "18px", padding: "24px", display: "flex", flexDirection: "column", gap: "8px", position: "relative" }}>
            <span style={{ fontSize: "36px", position: "absolute", top: "18px", right: "18px" }}>❤️</span>
            <span style={{ fontSize: "13px", fontWeight: "700", color: "#64748b", textTransform: "uppercase" }}>Lives Saved Impact</span>
            <span style={{ fontSize: "32px", fontWeight: "900", color: "#e63946" }}>
              {history.length * 3}
            </span>
            <span style={{ fontSize: "12px", color: "#94a3b8", fontWeight: "500" }}>1 donation helps save up to 3 lives</span>
          </div>

          <div style={{ backgroundColor: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "18px", padding: "24px", display: "flex", flexDirection: "column", gap: "8px", position: "relative" }}>
            <span style={{ fontSize: "36px", position: "absolute", top: "18px", right: "18px" }}>📅</span>
            <span style={{ fontSize: "13px", fontWeight: "700", color: "#64748b", textTransform: "uppercase" }}>Eligibility Status</span>
            <span style={{ fontSize: "18px", fontWeight: "800", color: eligibility.eligible ? "#10b981" : "#d97706", marginTop: "12px" }}>
              {eligibility.eligible ? "Eligible to Donate Now ✅" : `In Cooldown (${eligibility.remainingDays}d)`}
            </span>
            <span style={{ fontSize: "12px", color: "#94a3b8", fontWeight: "500" }}>
              Last Date: {userProfile?.lastDonationDate ? new Date(userProfile.lastDonationDate).toLocaleDateString() : "Never"}
            </span>
          </div>
        </div>

        {/* Donation history timeline */}
        <div style={{ backgroundColor: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "20px", padding: "32px", boxShadow: "0 8px 30px rgba(0,0,0,0.02)" }}>
          <h3 style={{ margin: "0 0 24px 0", color: "#0f172a", fontSize: "18px", fontWeight: "800" }}>
            Donation Records
          </h3>

          {history.length === 0 ? (
            <div style={{ textAlign: "center", padding: "48px 0", color: "#64748b" }}>
              <span style={{ fontSize: "40px", display: "block", marginBottom: "12px" }}>🛡️</span>
              <h4 style={{ margin: "0 0 4px 0", color: "#0f172a", fontWeight: "700" }}>No Recorded Donations</h4>
              <p style={{ margin: 0, fontSize: "13px" }}>Commit to emergency broadcasts to build up your log records.</p>
            </div>
          ) : (
            <div style={{ position: "relative", paddingLeft: "32px", borderLeft: "2px solid #e2e8f0", marginLeft: "12px" }}>
              {history.map((hist, idx) => {
                const date = new Date(hist.donatedAt).toLocaleDateString("en-US", {
                  year: "numeric", month: "long", day: "numeric"
                });
                const hospitalName = hist.hospitalId?.name || "Affiliate Hospital";
                const phone = hist.hospitalId?.phone || "No phone";
                const email = hist.hospitalId?.email || "No email";

                return (
                  <div key={idx} style={{ marginBottom: "28px", position: "relative" }}>
                    <div style={{
                      position: "absolute", left: "-42px", top: "4px",
                      width: "18px", height: "18px", borderRadius: "50%",
                      backgroundColor: "#ffffff", border: "4px solid #10b981",
                      boxShadow: "0 2px 6px rgba(16,185,129,0.2)"
                    }} />

                    <div style={{
                      backgroundColor: "#f8fafc", border: "1px solid #e2e8f0",
                      borderRadius: "14px", padding: "16px 20px",
                      display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px"
                    }}>
                      <div>
                        <span style={{ fontSize: "11px", color: "#64748b", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                          {date}
                        </span>
                        <h4 style={{ margin: "3px 0 6px 0", fontSize: "15px", color: "#0f172a", fontWeight: "800" }}>
                          🏥 {hospitalName}
                        </h4>
                        <div style={{ fontSize: "12px", color: "#64748b", fontWeight: "500" }}>
                          <span>📞 {phone}</span> • <span style={{ marginLeft: "6px" }}>✉️ {email}</span>
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <span style={{
                          backgroundColor: "#e6fcf5", color: "#0ca678", border: "1px solid #c3fae8",
                          padding: "4px 10px", borderRadius: "8px", fontSize: "12px", fontWeight: "700"
                        }}>
                          🧬 {hist.bloodGroup} Group
                        </span>
                        <span style={{
                          backgroundColor: "#edf2ff", color: "#364fc7", border: "1px solid #d0bfff",
                          padding: "4px 10px", borderRadius: "8px", fontSize: "12px", fontWeight: "700"
                        }}>
                          📦 {hist.units} Unit(s)
                        </span>
                        
                        <button
                          onClick={() => {
                            alert(`📜 CERTIFICATE OF HEROISM\n\nThis certifies that ${userProfile.name} successfully donated ${hist.units} unit(s) of ${hist.bloodGroup} blood on ${date} at ${hospitalName}.\n\nThank you for saving lives!`);
                          }}
                          style={{
                            border: "1px solid #cbd5e1", background: "#fff", cursor: "pointer",
                            borderRadius: "8px", padding: "6px 10px", fontSize: "11px", fontWeight: "700",
                            color: "#475569"
                          }}
                        >
                          View Certificate 📜
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
