import axios from "axios";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import ResetPasswordModal from "../components/ResetPasswordModal";

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
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    bloodGroup: "",
    city: "",
    profilePhoto: "",
    lat: 0,
    lng: 0
  });

  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });
  
  const [openFaq, setOpenFaq] = useState(null);

  const toggleFaq = (index) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  const FAQS = [
    { q: "How often can I donate blood?", a: "To ensure donor safety, you are eligible to donate whole blood once every 90 days. The system automatically tracks this and calculates your remaining cooldown days on your dashboard statistics." },
    { q: "What precautions should I take before donating?", a: "Stay hydrated by drinking plenty of water, consume a healthy, low-fat meal prior to your appointment, and bring a government-issued photo ID. Avoid alcohol and heavy exercise 24 hours before donating." },
    { q: "How are my location settings used?", a: "Your city and coordinates (lat/lng) are used solely to match you with compatible emergency blood requests nearby. Your precise location is never exposed publicly to unverified users." },
    { q: "Can I directly communicate with the hospital?", a: "Yes, once you accept or view a broadcast request from a hospital, you can use the built-in real-time Live Chat tab to message their coordinators directly." }
  ];

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

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      return alert("New passwords do not match");
    }
    try {
      const token = localStorage.getItem("token");
      await axios.put("http://localhost:5000/api/user/change-password", {
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert("🎉 Password updated successfully!");
      setPasswordData({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (err) {
      alert(err.response?.data?.message || "Password Update Failed");
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
    <div style={{ minHeight: "100vh", backgroundColor: "#f0f2f5", fontFamily: "'Inter', system-ui, sans-serif", color: "#334155" }}>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet" />
      <style>{`
        .premium-input {
          padding: 12px 16px;
          border-radius: 12px;
          border: 1.5px solid #cbd5e1;
          font-size: 14px;
          outline: none;
          transition: all 0.2s ease;
          background-color: #ffffff;
        }
        .premium-input:focus {
          border-color: #e63946;
          box-shadow: 0 0 0 4px rgba(230, 57, 70, 0.15);
        }
        .premium-input:disabled {
          background-color: #f1f5f9;
          border-color: #e2e8f0;
          color: #64748b;
          cursor: not-allowed;
        }
        .premium-input-lock {
          padding: 12px 16px;
          border-radius: 12px;
          border: 1.5px solid #e2e8f0;
          background-color: #f1f5f9;
          color: #64748b;
          font-size: 14px;
          cursor: not-allowed;
          outline: none;
        }
        .preset-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.08);
        }
        .save-btn {
          background-color: #e63946;
          color: white;
          padding: 14px;
          border: none;
          border-radius: 12px;
          font-weight: 800;
          cursor: pointer;
          margin-top: 10px;
          font-size: 15px;
          box-shadow: 0 6px 20px rgba(230,57,70,0.2);
          transition: all 0.25s ease;
        }
        .save-btn:hover {
          background-color: #d62839;
          transform: translateY(-1px);
          box-shadow: 0 8px 24px rgba(230,57,70,0.3);
        }
        .auto-btn {
          padding: 12px 18px;
          background-color: #0f172a;
          color: #fff;
          border: none;
          border-radius: 10px;
          cursor: pointer;
          font-weight: 700;
          font-size: 12px;
          display: flex;
          align-items: center;
          gap: 6px;
          transition: all 0.2s ease;
        }
        .auto-btn:hover {
          background-color: #1e293b;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(15,23,42,0.15);
        }
      `}</style>

      {/* 🔝 NAVBAR */}
      <nav style={{ backgroundColor: "white", padding: "15px 30px", boxShadow: "0 2px 10px rgba(0,0,0,0.1)", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
          <h2 style={{ margin: 0, color: "#e63946", display: "flex", alignItems: "center", gap: "8px" }}>
            🩸 Donor Dashboard
          </h2>
        </div>

        <div style={{ display: "flex", gap: "25px", alignItems: "center" }}>
          <span onClick={() => router.push("/donorDashboard")} style={{ cursor: "pointer", fontSize: "14px", fontWeight: "600", color: "#555", paddingBottom: "5px" }}>
            Emergency Feed
          </span>
          <span onClick={() => router.push("/donorDashboard?tab=messages")} style={{ cursor: "pointer", fontSize: "14px", fontWeight: "600", color: "#555", paddingBottom: "5px" }}>
            💬 Messages
          </span>
          <span onClick={() => router.push("/history")} style={{ cursor: "pointer", fontSize: "14px", fontWeight: "600", color: "#555", paddingBottom: "5px" }}>
            Donation History
          </span>
          <span onClick={() => router.push("/donorDashboard?tab=reports")} style={{ cursor: "pointer", fontSize: "14px", fontWeight: "600", color: "#555", paddingBottom: "5px" }}>
            My Reports
          </span>
          <span style={{ cursor: "pointer", fontSize: "14px", fontWeight: "bold", color: "#e63946", borderBottom: "2px solid #e63946", paddingBottom: "5px" }}>
            Profile
          </span>

          {/* NAVBAR PROFILE SECTION & AVAILABILITY SELECTOR */}
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

              {/* Profile Photo */}
              {userProfile.profilePhoto ? (
                userProfile.profilePhoto.length <= 4 ? (
                  <span style={{ fontSize: "24px" }}>{userProfile.profilePhoto}</span>
                ) : (
                  <img src={userProfile.profilePhoto} alt="Nav" style={{ height: "36px", width: "36px", borderRadius: "50%", objectFit: "cover", border: "2px solid #ddd" }} />
                )
              ) : (
                <div style={{ height: "36px", width: "36px", backgroundColor: "#e63946", color: "white", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px", fontWeight: "bold", border: "2px solid #eee" }}>
                  {(userProfile.name || "").charAt(0).toUpperCase()}
                </div>
              )}

              {/* Logout Button */}
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

      {/* MAIN CONTAINER */}
      <main style={{ maxWidth: "1200px", margin: "30px auto", padding: "0 20px", boxSizing: "border-box" }}>

        <header style={{ marginBottom: "36px" }}>
          <h1 style={{ margin: 0, fontSize: "28px", fontWeight: "800", color: "#0f172a", letterSpacing: "-0.8px" }}>
            Profile Configuration
          </h1>
          <p style={{ margin: "4px 0 0 0", color: "#64748b", fontSize: "14px" }}>
            Configure your personal details, physical coordinates, availability, and select an avatar.
          </p>
        </header>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.6fr", gap: "28px", alignItems: "start" }}>

          {/* Left Column Stack */}
          <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
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

            {/* Change Password Card (replaced with modal trigger) */}
            <div style={{ backgroundColor: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "20px", padding: "28px" }}>
              <h3 style={{ margin: "0 0 4px 0", fontSize: "16px", fontWeight: "800", color: "#0f172a" }}>
                🔒 Reset Password
              </h3>
              <p style={{ margin: "0 0 20px 0", color: "#64748b", fontSize: "13px" }}>
                Update your account password to keep your credentials secure.
              </p>
              <button className="save-btn" style={{ marginTop: "8px" }} onClick={() => setIsResetModalOpen(true)}>
                Change Password
              </button>
            </div>
            {/* Reset Password Modal */}
            <ResetPasswordModal isOpen={isResetModalOpen} onClose={() => setIsResetModalOpen(false)} />
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
                    className="premium-input"
                    required
                  />
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <label style={{ fontSize: "11px", fontWeight: "800", color: "#475569", textTransform: "uppercase" }}>Phone Number</label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="premium-input"
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
                    className="premium-input-lock"
                  />
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <label style={{ fontSize: "11px", fontWeight: "800", color: "#475569", textTransform: "uppercase" }}>Blood Group</label>
                  <select
                    value={formData.bloodGroup}
                    disabled
                    className="premium-input-lock"
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
                    className="premium-input"
                    style={{ flex: 1 }}
                    required
                  />
                  <button
                    type="button"
                    onClick={handleAutoLocation}
                    className="auto-btn"
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
                className="save-btn"
              >
                Save Profile Configuration
              </button>
            </form>
          </div>
        </div>


      </main>
    </div>
  );
}
