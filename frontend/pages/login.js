import axios from "axios";
import { useRouter } from "next/router";
import { useState } from "react";

export default function Login() {
  const router = useRouter();

  const [form, setForm] = useState({
    emailOrUsername: "",
    password: "",
  });

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setErrorMsg(""); // clear error on typing
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");

    try {
      const res = await axios.post("http://localhost:5000/api/auth/login", form);

      if (!res.data?.token || !res.data?.user?.role) {
        setErrorMsg("Unexpected server response. Please try again.");
        return;
      }

      localStorage.setItem("token", res.data.token);
      localStorage.setItem("role", res.data.user.role);

      const role = res.data.user.role;
      if (role === "donor") {
        await router.push("/donorDashboard");
      } else if (role === "hospital") {
        await router.push("/hospitalDashboard");
      } else {
        await router.push("/adminDashboard");
      }
    } catch (err) {
      if (!err.response) {
        setErrorMsg(
          "Cannot reach the server. Make sure the backend is running on port 5000."
        );
      } else {
        setErrorMsg(
          err.response.data?.message ||
            (err.response.status >= 500
              ? "Server error during login. Restart the backend and try again."
              : "Login failed. Check your email and password.")
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />

      <div className="login-card">
        <div className="login-header">
          <div className="logo-icon">🩸</div>
          <h1>Welcome Back</h1>
          <p>Sign in to continue saving lives</p>
        </div>

        {errorMsg && <div className="error-banner">{errorMsg}</div>}

        <form onSubmit={handleLogin} className="login-form">
          <div className="input-group">
            <label>Email or Username</label>
            <input
              type="text"
              name="emailOrUsername"
              placeholder="you@example.com or your-username"
              value={form.emailOrUsername}
              onChange={handleChange}
              required
            />
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
            <div className="forgot-link-wrapper">
              <span
                className="forgot-link"
                onClick={() => router.push("/forgot-password")}
              >
                Forgot Password?
              </span>
            </div>
          </div>

          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? <span className="spinner"></span> : "Sign In"}
          </button>
        </form>

        <div className="login-footer">
          Don't have an account?{" "}
          <span className="register-link" onClick={() => router.push("/register")}>
            Create one
          </span>
        </div>
      </div>

      <style jsx global>{`
        * { box-sizing: border-box; font-family: 'Inter', system-ui, sans-serif; }
        body, html { margin: 0; padding: 0; min-height: 100vh; background: #f8fafc; }
      `}</style>

      <style>{`
        .login-container {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          background: linear-gradient(135deg, #fdfbfb 0%, #ebedee 100%);
          padding: 20px;
        }

        .login-card {
          background: #ffffff;
          max-width: 420px;
          width: 100%;
          border-radius: 24px;
          padding: 40px;
          box-shadow: 0 24px 50px rgba(0, 0, 0, 0.05);
          animation: slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .login-header {
          text-align: center;
          margin-bottom: 30px;
        }

        .logo-icon {
          font-size: 52px;
          margin-bottom: 12px;
          display: inline-block;
          animation: pulse 2.5s ease-in-out infinite;
        }

        .login-header h1 {
          margin: 0;
          color: #0f172a;
          font-size: 30px;
          font-weight: 800;
          letter-spacing: -1px;
        }

        .login-header p {
          color: #64748b;
          margin: 6px 0 0 0;
          font-size: 15px;
          font-weight: 500;
        }

        .error-banner {
          background: #fef2f2;
          color: #b91c1c;
          padding: 14px;
          border-radius: 12px;
          font-size: 14px;
          font-weight: 600;
          text-align: center;
          margin-bottom: 24px;
          border: 1px solid #fecaca;
          animation: shake 0.4s ease-in-out;
        }

        .login-form {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .input-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .input-group label {
          font-size: 13px;
          font-weight: 700;
          color: #334155;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .input-group input {
          width: 100%;
          padding: 16px 18px;
          border: 2px solid #e2e8f0;
          border-radius: 14px;
          font-size: 15px;
          color: #0f172a;
          outline: none;
          transition: all 0.2s ease;
          background: #f8fafc;
        }

        .input-group input:focus {
          border-color: #ef4444;
          background: #ffffff;
          box-shadow: 0 4px 16px rgba(239, 68, 68, 0.1);
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

        .forgot-link-wrapper {
          display: flex;
          justify-content: flex-end;
          margin-top: 8px;
        }

        .forgot-link {
          font-size: 13px;
          font-weight: 600;
          color: #e11d48;
          cursor: pointer;
          transition: color 0.2s, text-decoration 0.2s;
        }

        .forgot-link:hover {
          color: #be123c;
          text-decoration: underline;
        }

        .login-btn {
          margin-top: 10px;
          width: 100%;
          padding: 16px;
          border: none;
          border-radius: 14px;
          background: linear-gradient(135deg, #e11d48, #be123c);
          color: white;
          font-size: 16px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          justify-content: center;
          align-items: center;
          box-shadow: 0 8px 20px rgba(225, 29, 72, 0.25);
        }

        .login-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 12px 28px rgba(225, 29, 72, 0.35);
        }

        .login-btn:active {
          transform: translateY(0);
          box-shadow: 0 4px 12px rgba(225, 29, 72, 0.2);
        }

        .login-btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
          transform: none;
          box-shadow: none;
        }

        .login-footer {
          margin-top: 32px;
          text-align: center;
          color: #64748b;
          font-size: 14px;
          font-weight: 500;
        }

        .register-link {
          color: #e11d48;
          font-weight: 700;
          cursor: pointer;
          transition: color 0.2s;
          margin-left: 4px;
        }



        .register-link:hover {
          color: #be123c;
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

        @keyframes pulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.1); }
          100% { transform: scale(1); }
        }

        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          50% { transform: translateX(5px); }
          75% { transform: translateX(-5px); }
        }
      `}</style>
    </div>
  );
}