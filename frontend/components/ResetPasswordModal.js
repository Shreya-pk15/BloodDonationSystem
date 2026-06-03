import { useState } from "react";
import axios from "axios";
import PropTypes from "prop-types";

// Simple strength checker – at least 8 chars, one uppercase, one number, one special character
const strongPasswordRegex = /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\[\]{};':"\\|,.<>/?`~-]).{8,}$/;

export default function ResetPasswordModal({ isOpen, onClose }) {
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleChange = (e) => {
    setPasswordData({ ...passwordData, [e.target.name]: e.target.value });
    setError("");
    setSuccess("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const { currentPassword, newPassword, confirmPassword } = passwordData;
    if (newPassword !== confirmPassword) {
      setError("New passwords do not match.");
      return;
    }
    if (!strongPasswordRegex.test(newPassword)) {
      setError(
        "Password must be at least 8 characters, include an uppercase letter, a number, and a special character."
      );
      return;
    }
    try {
      const token = localStorage.getItem("token");
      await axios.put(
        "http://localhost:5000/api/user/change-password",
        { currentPassword, newPassword },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSuccess("Password updated successfully!");
      setPasswordData({ currentPassword: "", newPassword: "", confirmPassword: "" });
      // auto‑close after short delay
      setTimeout(onClose, 1500);
    } catch (err) {
      setError(err.response?.data?.message || "Password update failed.");
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0,0,0,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        backdropFilter: "blur(4px)"
      }}
      onClick={onClose}
    >
      {/* Modal container */}
      <div
        style={{
          width: "380px",
          background: "rgba(255,255,255,0.85)",
          borderRadius: "20px",
          padding: "28px",
          boxShadow: "0 12px 32px rgba(0,0,0,0.12)",
          position: "relative",
          backdropFilter: "blur(8px)"
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: "12px",
            right: "12px",
            background: "transparent",
            border: "none",
            fontSize: "18px",
            cursor: "pointer",
            color: "#64748b"
          }}
        >
          ✕
        </button>
        <h3 style={{ margin: 0, marginBottom: "12px", color: "#0f172a", fontWeight: "800" }}>
          🔒 Reset Password
        </h3>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <label style={{ fontSize: "11px", fontWeight: "800", color: "#475569", marginBottom: "4px" }}>
              Current Password
            </label>
            <div style={{ position: "relative" }}>
              <input
                type={showCurrent ? "text" : "password"}
                name="currentPassword"
                value={passwordData.currentPassword}
                onChange={handleChange}
                className="premium-input"
                required
                style={{ width: "100%" }}
              />
              <button
                type="button"
                onClick={() => setShowCurrent(!showCurrent)}
                style={{
                  position: "absolute",
                  right: "8px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: "#64748b"
                }}
                aria-label="Toggle visibility"
              >
                {showCurrent ? "🙈" : "👁️"}
              </button>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            <label style={{ fontSize: "11px", fontWeight: "800", color: "#475569", marginBottom: "4px" }}>
              New Password
            </label>
            <div style={{ position: "relative" }}>
              <input
                type={showNew ? "text" : "password"}
                name="newPassword"
                value={passwordData.newPassword}
                onChange={handleChange}
                className="premium-input"
                required
                style={{ width: "100%" }}
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                style={{
                  position: "absolute",
                  right: "8px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: "#64748b"
                }}
                aria-label="Toggle visibility"
              >
                {showNew ? "🙈" : "👁️"}
              </button>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            <label style={{ fontSize: "11px", fontWeight: "800", color: "#475569", marginBottom: "4px" }}>
              Confirm New Password
            </label>
            <div style={{ position: "relative" }}>
              <input
                type={showConfirm ? "text" : "password"}
                name="confirmPassword"
                value={passwordData.confirmPassword}
                onChange={handleChange}
                className="premium-input"
                required
                style={{ width: "100%" }}
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                style={{
                  position: "absolute",
                  right: "8px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: "#64748b"
                }}
                aria-label="Toggle visibility"
              >
                {showConfirm ? "🙈" : "👁️"}
              </button>
            </div>
          </div>

          {error && (
            <div style={{ color: "#b91c1c", fontSize: "13px" }}>
              {error}
            </div>
          )}
          {success && (
            <div style={{ color: "#15803d", fontSize: "13px" }}>
              {success}
            </div>
          )}

          <button
            type="submit"
            className="save-btn"
            style={{ alignSelf: "flex-end" }}
          >
            Update Password
          </button>
        </form>
      </div>
    </div>
  );
}

ResetPasswordModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired
};
