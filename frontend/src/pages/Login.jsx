import React, { useState, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Shield, Mail, Lock, Eye, EyeOff, ArrowRight, ArrowLeft, AlertCircle, Wifi } from "lucide-react";
import { getCurrentUser } from "../services/api";
import { useAuthSocket } from "../hooks/useAuthSocket";
import "./Login.css";

export default function Login() {
  const [email, setEmail]             = useState("");
  const [password, setPassword]       = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage]         = useState({ type: "", text: "" });
  const [isLoading, setIsLoading]     = useState(false);
  const [rememberMe, setRememberMe]   = useState(false);
  const navigate = useNavigate();

  // ── WebSocket event handler ─────────────────────────────────────────────────
  const handleWsEvent = useCallback((data) => {
    switch (data.event) {

      case "status":
        setMessage({ type: "info", text: data.message });
        break;

      case "login_success":
  // Store token + user
  localStorage.setItem("token", data.token);
  localStorage.setItem("user", JSON.stringify(data.user));

  setMessage({ type: "success", text: "Login successful! Redirecting..." });
  setIsLoading(false);

  // ✅ Use longer delay + window.location instead of navigate
  setTimeout(() => {
    if (data.role === "admin") {
      window.location.href = "/dashboard/admin";
    } else {
      window.location.href = "/dashboard/home";
    }
  }, 800);
  break;

      

      case "login_failed":
        setMessage({ type: "error", text: data.message });
        setIsLoading(false);
        break;

      case "account_pending":
        setMessage({ type: "warning", text: data.message });
        setIsLoading(false);
        break;

      case "account_rejected":
        setMessage({ type: "error", text: data.message });
        setIsLoading(false);
        break;

      case "account_locked":
        setMessage({ type: "error", text: "Account locked. Contact support." });
        setIsLoading(false);
        break;

      case "error":
        setMessage({ type: "error", text: data.message || "Server error." });
        setIsLoading(false);
        break;

      default:
        break;
    }
  }, [navigate]);

  const { sendLogin, connected } = useAuthSocket(handleWsEvent);

  // ── Submit handler ───────────────────────────────────────────────────────────
  const handleLogin = (e) => {
    e.preventDefault();
    setMessage({ type: "", text: "" });
    setIsLoading(true);
    sendLogin(email, password);   // fires over WebSocket — no await needed
  };

  // ── Message renderer (same as before + info style) ───────────────────────────
  const renderMessage = () => {
    if (!message.text) return null;

    if (message.type === "warning") {
      return (
        <div className="form-message warning">
          <AlertCircle size={20} />
          <div className="message-content">
            <strong>Account Pending Approval</strong>
            <p>{message.text}</p>
            <div className="approval-info">
              <p>What happens next?</p>
              <ul>
                <li>Your account is currently under review</li>
                <li>You'll receive an email notification once approved</li>
                <li>If rejected, you'll receive an explanation via email</li>
              </ul>
              <p className="contact-support">
                Need help? <Link to="/contact">Contact Support</Link>
              </p>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className={`form-message ${message.type}`}>
        {message.text}
      </div>
    );
  };

  return (
    <div className="auth-container">
      <div className="auth-background">
        <div className="auth-orb orb-1"></div>
        <div className="auth-orb orb-2"></div>
      </div>

      <Link to="/" className="back-to-home">
        <ArrowLeft size={20} />
        <span>Back to Home</span>
      </Link>

      {/* ── WS connection indicator ── */}
      <div style={{
        position: "fixed", top: 12, right: 16,
        display: "flex", alignItems: "center", gap: 6,
        fontSize: 12, opacity: 0.7
      }}>
        <Wifi size={14} color={connected ? "#22c55e" : "#ef4444"} />
        <span>{connected ? "Live" : "Connecting..."}</span>
      </div>

      <div className="auth-content">
        {/* Left branding — unchanged */}
        <div className="auth-branding">
          <div className="brand-header">
            <Shield size={48} className="brand-icon" />
            <h1 className="brand-title">ForenVision</h1>
          </div>
          <h2 className="brand-tagline">Welcome Back to ForenVision</h2>
          <p className="brand-description">
            Sign in to access your forensic investigation dashboard, manage cases,
            analyze evidence, and collaborate with your team in real-time.
          </p>
          <div className="brand-features">
            <div className="feature-item"><span>✓ Secure Authentication</span></div>
            <div className="feature-item"><span>✓ End-to-End Encryption</span></div>
            <div className="feature-item"><span>✓ 24/7 Access to Cases</span></div>
          </div>
          <div className="approval-notice">
            <h4>For New Investigators:</h4>
            <p>New investigator accounts require admin approval before accessing the dashboard.</p>
          </div>
        </div>

        {/* Right form — same structure, new handler */}
        <div className="auth-form-container">
          <form onSubmit={handleLogin} className="auth-form">
            <div className="form-header">
              <h2 className="form-title">Sign In</h2>
              <p className="form-subtitle">Enter your credentials to continue</p>
            </div>

            {renderMessage()}

            <div className="form-group">
              <label className="form-label">Email Address</label>
              <div className="input-wrapper">
                <input
                  type="email"
                  placeholder="your.email@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="form-input"
                  disabled={isLoading}
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Password</label>
              <div className="input-wrapper">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="form-input"
                  disabled={isLoading}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={isLoading}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            <div className="form-options">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  disabled={isLoading}
                />
                <span>Remember me</span>
              </label>
            </div>

            <button type="submit" className="submit-button" disabled={isLoading || !connected}>
              {isLoading ? (
                <span className="button-loading">Signing In...</span>
              ) : (
                <>Sign In <ArrowRight size={20} /></>
              )}
            </button>

            <div className="form-footer">
              <p className="footer-text">
                Don't have an account?{" "}
                <Link to="/signup" className="footer-link">Create Account</Link>
              </p>
              <p className="footer-note">
                New investigators: Your account will be active after admin approval.
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
