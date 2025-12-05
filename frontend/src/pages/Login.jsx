// Login.jsx
import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Shield, Mail, Lock, Eye, EyeOff, ArrowRight, ArrowLeft } from "lucide-react";
import { login, getCurrentUser } from "../services/api";
import "./Login.css";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [isLoading, setIsLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setMessage({ type: "", text: "" });
    setIsLoading(true);

    try {
      const response = await login(email, password);
      
      if (response.ok) {
        // The api.js login function already parsed the JSON and stored everything
        // Just get the user from localStorage
        const user = getCurrentUser();
        
        setMessage({ type: "success", text: "Login successful! Redirecting..." });
        
        // Navigate based on role
        setTimeout(() => {
          if (user.role === "admin") {
            navigate("/dashboard/admin", { replace: true });
          } else {
            navigate("/dashboard/home", { replace: true });
          }
        }, 500);
      } else {
        // For error responses, we can safely read the body
        const errorData = await response.json();
        setMessage({ type: "error", text: errorData.detail || "Invalid email or password" });
      }
    } catch (error) {
      console.error("Login error:", error);
      setMessage({ type: "error", text: "Server error. Please try again later." });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-background">
        <div className="auth-orb orb-1"></div>
        <div className="auth-orb orb-2"></div>
      </div>

      {/* Back to Landing Page Button */}
      <Link to="/" className="back-to-home">
        <ArrowLeft size={20} />
        <span>Back to Home</span>
      </Link>

      <div className="auth-content">
        {/* Left Side - Branding */}
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
            <div className="feature-item">
              <span>✓ Secure Authentication</span>
            </div>
            <div className="feature-item">
              <span>✓ End-to-End Encryption</span>
            </div>
            <div className="feature-item">
              <span>✓ 24/7 Access to Cases</span>
            </div>
          </div>
        </div>

        {/* Right Side - Form */}
        <div className="auth-form-container">
          <form onSubmit={handleLogin} className="auth-form">
            <div className="form-header">
              <h2 className="form-title">Sign In</h2>
              <p className="form-subtitle">Enter your credentials to continue</p>
            </div>

            {message.text && (
              <div className={`form-message ${message.type}`}>
                {message.text}
              </div>
            )}

            {/* Email */}
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

            {/* Password */}
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

            {/* Remember Me */}
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

            <button type="submit" className="submit-button" disabled={isLoading}>
              {isLoading ? (
                <span className="button-loading">Signing In...</span>
              ) : (
                <>
                  Sign In
                  <ArrowRight size={20} />
                </>
              )}
            </button>

            <div className="form-footer">
              <p className="footer-text">
                Don't have an account?{" "}
                <Link to="/signup" className="footer-link">
                  Create Account
                </Link>
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}