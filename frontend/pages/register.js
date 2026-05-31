import axios from "axios";
import { useRouter } from "next/router";
import { useState } from "react";

export default function Register() {
  const router = useRouter();

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    role: "donor",
    bloodGroup: "",
    city: "",
    lat: "",
    lng: "",
  });

  const [loading, setLoading] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setErrorMsg("");
  };

  // AUTO DETECT LOCATION (City + Lat/Lng)
  const getLiveLocation = () => {
    if (!navigator.geolocation) {
      setErrorMsg("Geolocation not supported by your browser");
      return;
    }

    setDetecting(true);
    setErrorMsg("");

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;

        setForm((prev) => ({
          ...prev,
          lat: latitude,
          lng: longitude,
        }));

        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
          );
          const data = await res.json();
          const city =
            data.address.city ||
            data.address.town ||
            data.address.village ||
            data.address.county ||
            "Unknown";

          setForm((prev) => ({ ...prev, city: city }));
          setSuccessMsg("Location Detected Successfully");
          setTimeout(() => setSuccessMsg(""), 3000);
        } catch (err) {
          setErrorMsg("Coordinates detected, but city fetch failed.");
        } finally {
          setDetecting(false);
        }
      },
      () => {
        setErrorMsg("Location permission denied. Please allow location access.");
        setDetecting(false);
      }
    );
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");

    try {
      if (form.role === "donor" && !form.bloodGroup) {
        setErrorMsg("Blood group is required for donors");
        setLoading(false);
        return;
      }
      if (!form.lat || !form.lng) {
        setErrorMsg("Please detect your location first");
        setLoading(false);
        return;
      }

      await axios.post("http://localhost:5000/api/auth/register", form);

      setSuccessMsg("Registered Successfully! Redirecting...");
      setTimeout(() => router.push("/login"), 1500);
    } catch (err) {
      setErrorMsg(err.response?.data?.message || "Registration Failed");
      setLoading(false);
    }
  };

  return (
    <div className="register-container">
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />

      <div className="register-card">
        <div className="register-header">
          <div className="logo-icon">➕</div>
          <h1>Create Account</h1>
          <p>Join BloodLink today</p>
        </div>

        {errorMsg && <div className="error-banner">{errorMsg}</div>}
        {successMsg && <div className="success-banner">{successMsg}</div>}

        <form onSubmit={handleRegister} className="register-form">
          <div className="form-grid">
            <div className="input-group">
              <label>Full Name / Hospital Name</label>
              <input type="text" name="name" placeholder="John Doe" value={form.name} onChange={handleChange} required />
            </div>

            <div className="input-group">
              <label>Email Address</label>
              <input type="email" name="email" placeholder="you@example.com" value={form.email} onChange={handleChange} required />
            </div>

            <div className="input-group">
              <label>Phone Number</label>
              <input type="text" name="phone" placeholder="+1 234 567 8900" value={form.phone} onChange={handleChange} required />
            </div>

            <div className="input-group">
              <label>Password</label>
              <div className="password-wrapper">
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  placeholder="••••••••"
                  value={form.password}
                  onChange={handleChange}
                  required
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? "👁️" : "👁️‍🗨️"}
                </button>
              </div>
            </div>

            <div className="input-group">
              <label>Account Type</label>
              <select name="role" value={form.role} onChange={handleChange} className="styled-select">
                <option value="donor">Individual Donor</option>
                <option value="hospital">Hospital / Clinic</option>
              </select>
            </div>

            {form.role === "donor" && (
              <div className="input-group">
                <label>Blood Group</label>
                <select name="bloodGroup" value={form.bloodGroup} onChange={handleChange} className="styled-select" required>
                  <option value="">Select Group</option>
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
            )}
          </div>

          <div className="location-section">
            <div className="input-group">
              <label>Location Profile</label>
              <div className="location-action">
                <button type="button" onClick={getLiveLocation} className="detect-btn" disabled={detecting}>
                  {detecting ? "Detecting..." : "📍 Auto Detect Location"}
                </button>
              </div>
            </div>

            {form.city && (
              <div className="location-result">
                <span><strong>City:</strong> {form.city}</span>
                <span className="coords">{Number(form.lat).toFixed(4)}, {Number(form.lng).toFixed(4)}</span>
              </div>
            )}
          </div>

          <button type="submit" className="register-btn" disabled={loading}>
            {loading ? <span className="spinner"></span> : "Create Account"}
          </button>
        </form>

        <div className="register-footer">
          Already have an account?{" "}
          <span className="login-link" onClick={() => router.push("/login")}>
            Sign in
          </span>
        </div>
      </div>

      <style jsx global>{`
        * { box-sizing: border-box; font-family: 'Inter', system-ui, sans-serif; }
        body, html { margin: 0; padding: 0; min-height: 100vh; background: #f8fafc; }
      `}</style>

      <style>{`
        .register-container {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          background: linear-gradient(135deg, #fdfbfb 0%, #ebedee 100%);
          padding: 40px 20px;
        }

        .register-card {
          background: #ffffff;
          max-width: 580px;
          width: 100%;
          border-radius: 24px;
          padding: 40px;
          box-shadow: 0 24px 50px rgba(0, 0, 0, 0.05);
          animation: slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .register-header {
          text-align: center;
          margin-bottom: 30px;
        }

        .logo-icon {
          font-size: 46px;
          margin-bottom: 12px;
          display: inline-block;
          animation: bounceIn 1s cubic-bezier(0.28, 0.84, 0.42, 1);
        }

        .register-header h1 {
          margin: 0;
          color: #0f172a;
          font-size: 28px;
          font-weight: 800;
          letter-spacing: -1px;
        }

        .register-header p {
          color: #64748b;
          margin: 6px 0 0 0;
          font-size: 15px;
          font-weight: 500;
        }

        .error-banner, .success-banner {
          padding: 14px;
          border-radius: 12px;
          font-size: 14px;
          font-weight: 600;
          text-align: center;
          margin-bottom: 24px;
          animation: slideDown 0.3s ease-out;
        }

        .error-banner {
          background: #fef2f2;
          color: #b91c1c;
          border: 1px solid #fecaca;
        }

        .success-banner {
          background: #dcfce7;
          color: #15803d;
          border: 1px solid #bbf7d0;
        }

        .form-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          margin-bottom: 24px;
        }

        @media (max-width: 500px) {
          .form-grid {
            grid-template-columns: 1fr;
          }
        }

        .input-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .input-group label {
          font-size: 12px;
          font-weight: 700;
          color: #334155;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .input-group input, .styled-select {
          width: 100%;
          padding: 14px 16px;
          border: 2px solid #e2e8f0;
          border-radius: 12px;
          font-size: 14px;
          color: #0f172a;
          outline: none;
          transition: all 0.2s ease;
          background: #f8fafc;
        }

        .styled-select {
          cursor: pointer;
          appearance: none;
          background-image: url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%2364748b%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E");
          background-repeat: no-repeat;
          background-position: right 14px top 50%;
          background-size: 10px auto;
        }

        .input-group input:focus, .styled-select:focus {
          border-color: #3b82f6;
          background: #ffffff;
          box-shadow: 0 4px 16px rgba(59, 130, 246, 0.1);
        }

        .input-group input::placeholder {
          color: #94a3b8;
          font-weight: 500;
        }

        .password-wrapper {
          position: relative;
          display: flex;
          align-items: center;
        }

        .password-toggle {
          position: absolute;
          right: 14px;
          background: none;
          border: none;
          cursor: pointer;
          font-size: 18px;
          padding: 4px;
          color: #64748b;
          transition: color 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .password-toggle:hover {
          color: #0f172a;
        }

        .location-section {
          background: #f1f5f9;
          padding: 20px;
          border-radius: 16px;
          border: 1px dashed #cbd5e1;
          margin-bottom: 24px;
        }

        .detect-btn {
          background: #0f172a;
          color: #ffffff;
          border: none;
          padding: 12px 20px;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          transition: transform 0.2s, background 0.2s;
        }

        .detect-btn:hover {
          background: #334155;
          transform: translateY(-1px);
        }

        .detect-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .location-result {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 14px;
          padding: 12px;
          background: #ffffff;
          border-radius: 10px;
          font-size: 13px;
          color: #334155;
          border: 1px solid #e2e8f0;
        }

        .coords {
          color: #94a3b8;
          font-family: monospace;
          background: #f8fafc;
          padding: 4px 8px;
          border-radius: 6px;
        }

        .register-btn {
          width: 100%;
          padding: 16px;
          border: none;
          border-radius: 14px;
          background: linear-gradient(135deg, #2563eb, #1d4ed8);
          color: white;
          font-size: 16px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          justify-content: center;
          align-items: center;
          box-shadow: 0 8px 20px rgba(37, 99, 235, 0.25);
        }

        .register-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 12px 28px rgba(37, 99, 235, 0.35);
        }

        .register-btn:active {
          transform: translateY(0);
          box-shadow: 0 4px 12px rgba(37, 99, 235, 0.2);
        }

        .register-btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
          transform: none;
        }

        .register-footer {
          margin-top: 32px;
          text-align: center;
          color: #64748b;
          font-size: 14px;
          font-weight: 500;
        }

        .login-link {
          color: #2563eb;
          font-weight: 700;
          cursor: pointer;
          transition: color 0.2s;
          margin-left: 4px;
        }

        .login-link:hover {
          color: #1d4ed8;
          text-decoration: underline;
        }

        .spinner {
          width: 22px;
          height: 22px;
          border: 3px solid rgba(255,255,255,0.3);
          border-radius: 50%;
          border-top-color: white;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        @keyframes slideUp {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes bounceIn {
          0% { transform: scale(0.3); opacity: 0; }
          50% { transform: scale(1.05); opacity: 1; }
          70% { transform: scale(0.9); }
          100% { transform: scale(1); }
        }
      `}</style>
    </div>
  );
}