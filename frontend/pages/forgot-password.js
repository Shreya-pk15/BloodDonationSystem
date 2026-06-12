import axios from "axios";
import { useRouter } from "next/router";
import { useState } from "react";

export default function ForgotPassword() {
    const router = useRouter();

    const [email, setEmail] = useState("");
    const [confirmEmail, setConfirmEmail] = useState("");
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");
    const [submitted, setSubmitted] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError("");
        setMessage("");

        if (!email.trim()) {
            setError("Please enter your email address");
            setLoading(false);
            return;
        } else if (email !== confirmEmail) {
            setError("Emails do not match");
            setLoading(false);
            return;
        }

        try {
            const res = await axios.post(
                "http://localhost:5000/api/auth/forgot-password",
                { email }
            );

            setMessage(
                res.data.message ||
                    "Password reset link sent to your registered email address. Please check your inbox."
            );
            setSubmitted(true);
            setTimeout(() => {
                router.push("/login");
            }, 3000);
        } catch (err) {
            setError(
                err.response?.data?.message ||
                    "This email is not registered. Please use the email you signed up with."
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="forgot-container">
            <link
                href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap"
                rel="stylesheet"
            />

            <div className="forgot-card">
                <div className="forgot-header">
                    <div className="logo-icon">🩸</div>
                    <h1>Forgot Password</h1>
                    <p>Enter your email to receive a password reset link</p>
                </div>

                {message && <div className="success-banner">{message}</div>}
                {error && <div className="error-banner">{error}</div>}

                {!submitted ? (
                    <form onSubmit={handleSubmit} className="forgot-form">
                        <div className="input-group">
                            <label>Email Address</label>
                            <input
                                type="email"
                                placeholder="you@example.com"
                                value={email}
                                onChange={(e) => {
                                    setEmail(e.target.value);
                                    setError("");
                                }}
                                required
                            />
                            <label>Confirm Email Address</label>
                            <input
                                type="email"
                                placeholder="confirm@example.com"
                                value={confirmEmail}
                                onChange={(e) => {
                                    setConfirmEmail(e.target.value);
                                    setError("");
                                }}
                                required
                            />
                        </div>

                        <button type="submit" className="forgot-btn" disabled={loading}>
                            {loading ? <span className="spinner"></span> : "Send Reset Link"}
                        </button>
                    </form>
                ) : null}

                <div className="forgot-footer">
                    Remember your password?{" "}
                    <span
                        className="login-link"
                        onClick={() => router.push("/login")}
                    >
                        Sign in
                    </span>
                </div>
            </div>



            <style jsx global>{`
        * {
          box-sizing: border-box;
          font-family: "Inter", system-ui, sans-serif;
        }
        body,
        html {
          margin: 0;
          padding: 0;
          min-height: 100vh;
          background: #f8fafc;
        }
      `}</style>

            <style jsx>{`
        .forgot-container {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          background: linear-gradient(135deg, #fdfbfb 0%, #ebedee 100%);
          padding: 20px;
        }

        .forgot-card {
          background: #ffffff;
          max-width: 420px;
          width: 100%;
          border-radius: 24px;
          padding: 40px;
          box-shadow: 0 24px 50px rgba(0, 0, 0, 0.05);
          animation: slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .forgot-header {
          text-align: center;
          margin-bottom: 30px;
        }

        .logo-icon {
          font-size: 52px;
          margin-bottom: 12px;
          display: inline-block;
          animation: pulse 2.5s ease-in-out infinite;
        }

        .forgot-header h1 {
          margin: 0;
          color: #0f172a;
          font-size: 30px;
          font-weight: 800;
          letter-spacing: -1px;
        }

        .forgot-header p {
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

        .success-banner {
          background: #f0fdf4;
          color: #16a34a;
          padding: 14px;
          border-radius: 12px;
          font-size: 14px;
          font-weight: 600;
          text-align: center;
          margin-bottom: 24px;
          border: 1px solid #86efac;
          animation: slideUp 0.4s ease-in-out;
        }

        .forgot-form {
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

        .forgot-btn {
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

        .forgot-btn:hover:not(:disabled) {
          opacity: 0.9;
          box-shadow: 0 12px 24px rgba(225, 29, 72, 0.35);
        }

        .forgot-btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .spinner {
          width: 20px;
          height: 20px;
          border: 3px solid rgba(255, 255, 255, 0.3);
          border-radius: 50%;
          border-top-color: white;
          animation: spin 0.8s linear infinite;
        }

        .forgot-footer {
          margin-top: 32px;
          text-align: center;
          color: #64748b;
          font-size: 14px;
          font-weight: 500;
        }

        .login-link {
          color: #e11d48;
          font-weight: 700;
          cursor: pointer;
          margin-left: 4px;
          transition: 0.2s;
        }

        .login-link:hover {
          text-decoration: underline;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes pulse {
          0% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.1);
          }
          100% {
            transform: scale(1);
          }
        }

        @keyframes shake {
          0%,
          100% {
            transform: translateX(0);
          }
          25% {
            transform: translateX(-5px);
          }
          50% {
            transform: translateX(5px);
          }
          75% {
            transform: translateX(-5px);
          }
        }

        @media (max-width: 480px) {
          .forgot-card {
            padding: 30px 20px;
          }

          .forgot-header h1 {
            font-size: 24px;
          }

          .logo-icon {
            font-size: 40px;
          }
        }
      `}</style>
        </div>
    );
}