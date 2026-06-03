import axios from "axios";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";

// Preset cartoon avatars for quick personalization
const AVATAR_PRESETS = [
  { emoji: "🦸‍♂️", label: "Hero Lifesaver" },
  { emoji: "❤️", label: "Heart Beat" },
  { emoji: "🩺", label: "Health Guard" },
  { emoji: "🧬", label: "Life Line" },
  { emoji: "🩹", label: "First Responder" },
  { emoji: "✨", label: "Hope Giver" }
];

export default function ProfilePage() {
  const router = useRouter();
  const [userProfile, setUserProfile] = useState(null);
  const [availability, setAvailability] = useState("available");
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    bloodGroup: "",
    city: "",
    profilePhoto: "",
    lat: 0,
    lng: 0
  });

  const getStatusColor = (status) => {
    const s = status || availability;
    if (s === "available") return "#10b981"; // Emerald
    if (s === "busy") return "#f59e0b"; // Amber
    return "#64748b"; // Slate
  };

  const fetchProfile = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        router.push("/login");
        return;
      }
      const res = await axios.get("http://localhost:5000/api/user/profile", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUserProfile(res.data);
      setAvailability(res.data.availability);
      setFormData({
        name: res.data.name || "",
        phone: res.data.phone || "",
        bloodGroup: res.data.bloodGroup || "",
        city: res.data.location?.city || "",
        profilePhoto: res.data.profilePhoto || "",
        lat: res.data.location?.lat || 0,
        lng: res.data.location?.lng || 0
      });
    } catch (err) {
      console.error("Failed to load profile", err);
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

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem("token");

      // Update profile info (Name, Phone, Blood Group, City, Profile Photo)
      await axios.put("http://localhost:5000/api/user/profile", formData, {
        headers: { Authorization: `Bearer ${token}` },
      });

      // Update precise coordinates on backend if set
      if (formData.lat && formData.lng) {
        await axios.put("http://localhost:5000/api/user/location", {
          city: formData.city,
          lat: formData.lat,
          lng: formData.lng
        }, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }

      alert("🎉 Profile updated successfully!");
      fetchProfile();
    } catch (err) {
      alert(err.response?.data?.message || "Update Failed");
    }
  };

  const handleAutoLocation = () => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition((pos) => {
        const { latitude, longitude } = pos.coords;
        axios.get(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`)
          .then((res) => {
            if (res.data?.address) {
              const city = res.data.address.city || res.data.address.town || res.data.address.village || "Unknown";
              setFormData((prev) => ({
                ...prev,
                city,
                lat: latitude,
                lng: longitude
              }));
              alert(`📍 Location Detected: ${city} (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`);
            }
          })
          .catch(() => alert("Reverse geocoding failed."));
      }, () => alert("Location access denied."));
    } else {
      alert("Geolocation not supported.");
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    window.location.href = "/login";
  };

  const handlePhotoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setFormData({ ...formData, profilePhoto: reader.result });
      reader.readAsDataURL(file);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  if (loading || !userProfile) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", justifyContent: "center", alignItems: "center", background: "#f8fafc", fontFamily: "'Inter', sans-serif" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
          <div style={{ width: "40px", height: "40px", border: "4px solid #cbd5e1", borderTop: "4px solid #e63946", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
          <span style={{ color: "#64748b", fontWeight: "600", fontSize: "15px" }}>Loading your profile...</span>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f8fafc", fontFamily: "'Inter', system-ui, sans-serif", display: "flex", flexDirection: "column", color: "#334155" }}>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet" />

      {/* TOP NAVBAR */}
      <nav style={{
        backgroundColor: "#ffffff",
        padding: "18px 28px",
        boxShadow: "0 2px 10px rgba(0,0,0,0.08)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        width: "100%",
        position: "sticky",
        top: 0,
        zIndex: 200,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <h2 style={{ margin: 0, color: "#1d3557", display: "flex", alignItems: "center", gap: "10px", fontSize: "20px", fontWeight: 800 }}>
            👤 Profile
          </h2>
          <span style={{ color: "#64748b", fontSize: "13px", fontWeight: 600 }}>
            Hospital profile settings and availability
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "18px" }}>
          <button
            type="button"
            onClick={() => router.push("/hospitalDashboard")}
            style={{
              background: "transparent",
              border: "none",
              color: "#334155",
              fontWeight: 700,
              cursor: "pointer",
              fontSize: "14px",
            }}
          >
            Hospital Dashboard
          </button>
          <button
            type="button"
            onClick={handleLogout}
            style={{
              backgroundColor: "#ef4444",
              color: "#ffffff",
              border: "none",
              borderRadius: "10px",
              padding: "10px 18px",
              cursor: "pointer",
              fontWeight: 700,
              fontSize: "14px",
            }}
          >
            Logout
          </button>
        </div>
      </nav>

      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
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
                AVATAR_PRESETS.find(p => p.emoji === userProfile.profilePhoto) ? (
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
            const active = item.id === "settings";
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

      {/* MAIN CONTENT CONTAINER */}
      <main style={{ flex: 1, padding: "40px", boxSizing: "border-box", overflowY: "auto", height: "100vh" }}>

        <div style={{ backgroundColor: "#ffffff", borderRadius: "18px", padding: "18px 22px", display: "flex", flexWrap: "wrap", gap: "22px", alignItems: "center", boxShadow: "0 4px 22px rgba(15, 23, 43, 0.06)", marginBottom: "28px" }}>
          <span onClick={() => router.push("/donorDashboard")} style={{ cursor: "pointer", fontSize: "14px", fontWeight: "600", color: "#475569", paddingBottom: "5px" }}>
            Emergency Feed
          </span>
          <span onClick={() => router.push("/donorDashboard?tab=messages")} style={{ cursor: "pointer", fontSize: "14px", fontWeight: "600", color: "#475569", paddingBottom: "5px" }}>
            💬 Messages
          </span>
          <span onClick={() => router.push("/history")} style={{ cursor: "pointer", fontSize: "14px", fontWeight: "600", color: "#475569", paddingBottom: "5px" }}>
            Donation History
          </span>
          <span style={{ cursor: "pointer", fontSize: "14px", fontWeight: "700", color: "#e63946", borderBottom: "2px solid #e63946", paddingBottom: "5px" }}>
            Profile Settings
          </span>
          <span onClick={() => router.push("/donorDashboard?tab=reports")} style={{ cursor: "pointer", fontSize: "14px", fontWeight: "600", color: "#475569", paddingBottom: "5px" }}>
            My Reports
          </span>
        </div>

        <header style={{ marginBottom: "36px" }}>
          <h1 style={{ margin: 0, fontSize: "28px", fontWeight: "800", color: "#0f172a", letterSpacing: "-0.8px" }}>
            Profile Configuration
          </h1>
          <p style={{ margin: "4px 0 0 0", color: "#64748b", fontSize: "14px" }}>
            Configure your personal details, physical coordinates, availability, and select an avatar.
          </p>
        </header>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.6fr", gap: "28px", alignItems: "start" }}>

          {/* Left panel: Avatar presets picker */}
          <div style={{ backgroundColor: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "20px", padding: "24px" }}>
            <h3 style={{ margin: "0 0 16px 0", fontSize: "16px", fontWeight: "800", color: "#0f172a" }}>
              Select Avatar Profile
            </h3>

            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "16px", marginBottom: "24px" }}>
              <div style={{
                width: "100px", height: "100px", borderRadius: "50%",
                backgroundColor: "#fee2e2", border: "4px solid #fff",
                boxShadow: "0 10px 25px rgba(230,57,70,0.15)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "52px", overflow: "hidden"
              }}>
                {formData.profilePhoto ? (
                  AVATAR_PRESETS.find(p => p.emoji === formData.profilePhoto) ? (
                    <span>{formData.profilePhoto}</span>
                  ) : (
                    <img src={formData.profilePhoto} alt="Avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  )
                ) : (
                  <span style={{ color: "#e63946", fontWeight: "800", fontSize: "36px" }}>
                    {(formData.name || "").charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <span style={{ fontSize: "12px", color: "#64748b", fontWeight: "600" }}>
                Active Avatar Profile Preview
              </span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px", marginBottom: "20px" }}>
              {AVATAR_PRESETS.map((preset, idx) => {
                const isSelected = formData.profilePhoto === preset.emoji;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setFormData({ ...formData, profilePhoto: preset.emoji })}
                    style={{
                      backgroundColor: isSelected ? "#fee2e2" : "#f8fafc",
                      border: isSelected ? "2.5px solid #e63946" : "1.5px solid #e2e8f0",
                      borderRadius: "12px", padding: "12px 6px", cursor: "pointer",
                      display: "flex", flexDirection: "column", alignItems: "center", gap: "4px",
                      transition: "all 0.2s"
                    }}
                  >
                    <span style={{ fontSize: "28px" }}>{preset.emoji}</span>
                    <span style={{ fontSize: "9px", color: "#64748b", fontWeight: "700", whiteSpace: "nowrap" }}>
                      {preset.label}
                    </span>
                  </button>
                );
              })}
            </div>

            <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: "16px" }}>
              <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "#475569", marginBottom: "8px" }}>
                Or Upload Custom Image
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                style={{
                  width: "100%", fontSize: "11px", color: "#64748b",
                  padding: "8px 10px", border: "1.5px solid #cbd5e1", borderRadius: "10px"
                }}
              />
            </div>
          </div>

          {/* Right panel: Profile Fields Form */}
          <div style={{ backgroundColor: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "20px", padding: "32px" }}>
            <h3 style={{ margin: "0 0 24px 0", fontSize: "18px", fontWeight: "800", color: "#0f172a" }}>
              Medical & Account Info
            </h3>

            <form onSubmit={handleUpdateProfile} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <label style={{ fontSize: "11px", fontWeight: "800", color: "#475569", textTransform: "uppercase" }}>Full Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    style={{ padding: "12px 14px", borderRadius: "10px", border: "1.5px solid #cbd5e1", fontSize: "14px", outline: "none" }}
                    required
                  />
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <label style={{ fontSize: "11px", fontWeight: "800", color: "#475569", textTransform: "uppercase" }}>Phone Number</label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    style={{ padding: "12px 14px", borderRadius: "10px", border: "1.5px solid #cbd5e1", fontSize: "14px", outline: "none" }}
                    required
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <label style={{ fontSize: "11px", fontWeight: "800", color: "#475569", textTransform: "uppercase" }}>Email Address</label>
                  <input
                    type="email"
                    value={userProfile.email}
                    disabled
                    style={{ padding: "12px 14px", borderRadius: "10px", border: "1.5px solid #e2e8f0", backgroundColor: "#f1f5f9", color: "#64748b", fontSize: "14px", cursor: "not-allowed" }}
                  />
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <label style={{ fontSize: "11px", fontWeight: "800", color: "#475569", textTransform: "uppercase" }}>Blood Group</label>
                  <select
                    value={formData.bloodGroup}
                    onChange={(e) => setFormData({ ...formData, bloodGroup: e.target.value })}
                    style={{ padding: "12px 14px", borderRadius: "10px", border: "1.5px solid #cbd5e1", fontSize: "14px", outline: "none", backgroundColor: "#fff" }}
                    required
                  >
                    <option value="">Select Blood Group</option>
                    {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map(bg => (
                      <option key={bg} value={bg}>{bg}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: "20px" }}>
                <label style={{ fontSize: "11px", fontWeight: "800", color: "#475569", textTransform: "uppercase", display: "block", marginBottom: "8px" }}>
                  Location Settings
                </label>
                <div style={{ display: "flex", gap: "10px", marginBottom: "8px" }}>
                  <input
                    type="text"
                    placeholder="Enter city"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    style={{ padding: "12px 14px", borderRadius: "10px", border: "1.5px solid #cbd5e1", fontSize: "14px", outline: "none", flex: 1 }}
                    required
                  />
                  <button
                    type="button"
                    onClick={handleAutoLocation}
                    style={{
                      padding: "12px 18px", backgroundColor: "#0f172a", color: "#fff",
                      border: "none", borderRadius: "10px", cursor: "pointer",
                      fontWeight: "700", fontSize: "12px", display: "flex", alignItems: "center", gap: "6px"
                    }}
                  >
                    📍 Auto Detect
                  </button>
                </div>

                {formData.lat && formData.lng ? (
                  <div style={{ display: "flex", gap: "6px", alignItems: "center", fontSize: "11px", color: "#10b981", fontWeight: "700", backgroundColor: "#ecfdf5", padding: "6px 10px", borderRadius: "8px", border: "1px solid #a7f3d0", width: "fit-content" }}>
                    <span>✓ Coordinates Synced:</span>
                    <span style={{ fontFamily: "monospace" }}>{formData.lat.toFixed(4)}, {formData.lng.toFixed(4)}</span>
                  </div>
                ) : (
                  <div style={{ fontSize: "11px", color: "#b45309", fontWeight: "600" }}>
                    ⚠️ Coordinates not configured. Tap 'Auto Detect' to map geolocation coordinates.
                  </div>
                )}
              </div>

              <button
                type="submit"
                style={{
                  backgroundColor: "#e63946", color: "white", padding: "14px",
                  border: "none", borderRadius: "12px", fontWeight: "800",
                  cursor: "pointer", marginTop: "10px", fontSize: "15px",
                  boxShadow: "0 6px 20px rgba(230,57,70,0.25)", transition: "all 0.2s"
                }}
              >
                Save Profile Configuration
              </button>
            </form>
          </div>
        </div>
      </main>
      </div>
}
