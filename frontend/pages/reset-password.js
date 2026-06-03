import axios from "axios";
import { useRouter } from "next/router";
import { useState, useEffect } from "react";

export default function ResetPassword() {
  const router = useRouter();
  const { token } = router.query;

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [tokenValid, setTokenValid] = useState(true);

  useEffect(() => {
    if (!token) {
      setError("No reset token provided. Please use the link from your email.");
      setTokenValid(false);
    }
  }, [token]);

  const validatePassword = () => {
    if (!password || !confirmPassword) {
      setError("Both password fields are required");
      return false;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters long");
      return false;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return false;
    }
    return true;
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");

    if (!validatePassword()) return;

    setLoading(true);
    try {
      const res = await axios.post(
        "http://localhost:5000/api/auth/reset-password",
        {
          token,
          password,
        }
      );

      setMessage(res.data.message || "Password reset successfully!");
      setTimeout(() => {
        router.push("/login");
      }, 2000);
    } catch (err) {
      const errorMsg = err.response?.data?.message || "Failed to reset password";
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  if (!tokenValid && !token) {
    return (
      <div className="reset-container">
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
        <div className="reset-card">
          <div className="reset-header">
            <div className="logo-icon">🩸</div>
            <h1>Reset Password</h1>
          </div>
          <div className="error-banner">{error}</div>
          <button
            className="back-btn"
            onClick={() => router.push("/login")}
          >
            Back to Login
          </button>
        </div>
        <style jsx>{`
          .reset-container {
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 20px;
            font-family: "Inter", system-ui, sans-serif;
          }

          .reset-card {
            background: white;
            border-radius: 12px;
            padding: 40px;
            max-width: 400px;
            width: 100%;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
          }

          .reset-header {
            text-align: center;
            margin-bottom: 30px;
          }

          .logo-icon {
            font-size: 48px;
            margin-bottom: 16px;
          }

          .reset-header h1 {
            font-size: 24px;
            font-weight: 700;
            color: #1a1a1a;
            margin: 0;
          }

          .error-banner {
            background: #fee;
            border: 1px solid #fcc;
            color: #c00;
            padding: 12px;
            border-radius: 8px;
            margin-bottom: 20px;
            font-size: 14px;
            text-align: center;
          }

          .back-btn {
            width: 100%;
            padding: 12px;
            background: #667eea;
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: background 0.2s;
          }

          .back-btn:hover {
            background: #5568d3;
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="reset-container">
      <link
        href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap"
        rel="stylesheet"
      />

      <div className="reset-card">
        <div className="reset-header">
          <div className="logo-icon">🩸</div>
          <h1>Reset Password</h1>
          <p>Enter your new password below</p>
        </div>

        {message && <div className="success-banner">{message}</div>}
        {error && <div className="error-banner">{error}</div>}

        <form onSubmit={handleResetPassword} className="reset-form">
          <div className="input-group">
            <label>New Password</label>
            <div className="password-wrapper">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Enter new password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError("");
                }}
                required
                minLength="6"
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
            <label>Confirm Password</label>
            <div className="password-wrapper">
              <input
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  setError("");
                }}
                required
                minLength="6"
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                aria-label={showConfirmPassword ? "Hide password" : "Show password"}
              >
                {showConfirmPassword ? "👁️" : "👁️‍🗨️"}
              </button>
            </div>
          </div>

          <button type="submit" className="reset-btn" disabled={loading || !token}>
            {loading ? <span className="spinner"></span> : "Reset Password"}
          </button>
        </form>

        <div className="reset-footer">
          Remember your password?{" "}
          <span
            className="login-link"
            onClick={() => router.push("/login")}
          >
            Sign in
          </span>
        </div>
      </div>

      <style jsx>{`
        * {
          box-sizing: border-box;
          font-family: "Inter", system-ui, sans-serif;
        }

        body,
        html {
          margin: 0;
          padding: 0;
          min-height: 100vh;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }

        .reset-container {
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 100vh;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          padding: 20px;
        }

        .reset-card {
          background: white;
          border-radius: 12px;
          padding: 40px;
          max-width: 400px;
          width: 100%;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
        }

        .reset-header {
          text-align: center;
          margin-bottom: 30px;
        }

        .logo-icon {
          font-size: 48px;
          margin-bottom: 16px;
          display: block;
        }

        .reset-header h1 {
          font-size: 24px;
          font-weight: 700;
          color: #1a1a1a;
          margin: 0 0 8px 0;
        }

        .reset-header p {
          font-size: 14px;
          color: #666;
          margin: 0;
        }

        .reset-form {
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
          font-size: 14px;
          font-weight: 600;
          color: #333;
        }

        .password-wrapper {
          position: relative;
          display: flex;
          align-items: center;
        }

        .input-group input {
          padding: 12px 40px 12px 14px;
          border: 1px solid #ddd;
          border-radius: 8px;
          font-size: 14px;
          transition: border-color 0.2s;
        }

        .input-group input:focus {
          outline: none;
          border-color: #667eea;
          box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }

        .password-toggle {
          position: absolute;
          right: 12px;
          background: none;
          border: none;
          cursor: pointer;
          font-size: 18px;
          padding: 4px;
        }

        .error-banner {
          background: #fee;
          border: 1px solid #fcc;
          color: #c00;
          padding: 12px;
          border-radius: 8px;
          margin-bottom: 20px;
          font-size: 14px;
          text-align: center;
        }

        .success-banner {
          background: #efe;
          border: 1px solid #cfc;
          color: #060;
          padding: 12px;
          border-radius: 8px;
          margin-bottom: 20px;
          font-size: 14px;
          text-align: center;
        }

        .reset-btn {
          padding: 14px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: opacity 0.2s;
        }

        .reset-btn:hover:not(:disabled) {
          opacity: 0.9;
        }

        .reset-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .spinner {
          display: inline-block;
          width: 16px;
          height: 16px;
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.6s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        .reset-footer {
          text-align: center;
          margin-top: 24px;
          font-size: 14px;
          color: #666;
        }

        .login-link {
          color: #667eea;
          font-weight: 600;
          cursor: pointer;
          transition: color 0.2s;
        }

        .login-link:hover {
          color: #764ba2;
        }

        @media (max-width: 480px) {
          .reset-card {
            padding: 30px 20px;
          }

          .reset-header h1 {
            font-size: 20px;
          }

          .logo-icon {
            font-size: 36px;
          }
        }
      `}</style>
    </div>
  );
}
