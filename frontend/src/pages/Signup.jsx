//signup.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Eye,
  EyeOff,
  ArrowRight,
  UserCircle,
  Briefcase,
  ArrowLeft,
} from "lucide-react";
import { signup } from "../services/api";
import "./Signup.css";

const validatePakistaniPhone = (phone) => {
  if (!phone || phone.trim() === "") return true;
  const cleaned = phone.replace(/[\s\-]/g, ""); // remove spaces and dashes
  // Covers: 03XXXXXXXXX (11 digits), +923XXXXXXXXX, 00923XXXXXXXXX, 923XXXXXXXXX
  const pattern = /^(\+92|0092|92|0)3[0-9]{9}$/;
  return pattern.test(cleaned);
};

export default function Signup() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    contactNumber: "",
    password: "",
    confirmPassword: "",
    role: "investigator",
    specialization: "",
    years_of_experience: "",
    certification: "",
    department: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const validateForm = () => {
    if (!formData.name.trim())
      return setMessage({ type: "error", text: "Name is required" });
    if (!formData.email.trim())
      return setMessage({ type: "error", text: "Email is required" });
    if (formData.password.length < 6)
      return setMessage({
        type: "error",
        text: "Password must be at least 6 characters",
      });
    if (formData.password !== formData.confirmPassword)
      return setMessage({ type: "error", text: "Passwords do not match" });

    // ✅ Pakistan phone validation
    if (
      formData.contactNumber &&
      !validatePakistaniPhone(formData.contactNumber)
    )
      return setMessage({
        type: "error",
        text: "Invalid phone number. Use format: 03XX-XXXXXXX or +923XXXXXXXXX",
      });

    if (formData.role === "investigator" && !formData.specialization.trim())
      return setMessage({
        type: "error",
        text: "Specialization is required for investigators",
      });

    setMessage({ type: "", text: "" });
    return true;
  };

  // Update the handleSubmit function in SignUp.jsx:

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    setIsLoading(true);

    try {
      const signupData = {
        email: formData.email,
        password: formData.password,
        name: formData.name,
        contact_number: formData.contactNumber,
        role: formData.role,
      };

      if (formData.role === "investigator") {
        signupData.specialization = formData.specialization;
        signupData.years_of_experience = formData.years_of_experience
          ? parseInt(formData.years_of_experience)
          : null;
        signupData.certification = formData.certification || null;
        signupData.department = formData.department || null;
      }

      const response = await signup(signupData);
      const data = await response.json();

      if (response.ok) {
        // Show different message for investigators requiring approval
        if (formData.role === "investigator" && data.requires_approval) {
          setMessage({
            type: "success",
            text: "Your investigator account has been created successfully! Your account is pending admin approval. You'll receive an email notification once approved. Until then, you won't be able to access the dashboard.",
          });
        } else {
          setMessage({
            type: "success",
            text: "Account created successfully! Redirecting to login...",
          });
        }

        setFormData({
          name: "",
          email: "",
          contactNumber: "",
          password: "",
          confirmPassword: "",
          role: "investigator",
          specialization: "",
          years_of_experience: "",
          certification: "",
          department: "",
        });

        // Only redirect non-investigators immediately
        if (formData.role !== "investigator") {
          setTimeout(() => navigate("/login"), 2000);
        }
      } else {
        setMessage({
          type: "error",
          text: data.detail || "Signup failed. Please try again.",
        });
      }
    } catch (error) {
      console.error("Signup error:", error);
      setMessage({
        type: "error",
        text: "Error connecting to server. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="signup-page auth-container">
       {" "}
      <div className="auth-background">
            <div className="auth-orb orb-1"></div>   {" "}
        <div className="auth-orb orb-2"></div> {" "}
      </div>
        {/* Back Button moved here */} {" "}
      <button className="back-button" onClick={() => navigate("/")}>
            <ArrowLeft size={20} /> Back  {" "}
      </button>
        {/* The form now acts as the main card/content container */} {" "}
      <form onSubmit={handleSubmit} className="auth-form" autoComplete="off">
               {" "}
        {message.text && (
          <div className={`form-message ${message.type}`}>{message.text}</div>
        )}
        <div className="form-header">
          <h2 className="form-title">Create Account</h2>

          <div className="investigator-note">
            <p>
              Only verified investigators can access case management features
            </p>
          </div>
        </div>
        <div className="form-grid">
          {/* ROW 1 */}
          <div className="form-group">
            <label className="form-label">Full Name</label>
            <input
              type="text"
              name="name"
              placeholder="John Doe"
              value={formData.name}
              onChange={handleChange}
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <div className="input-wrapper">
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                placeholder="Enter your password"
                value={formData.password}
                onChange={handleChange}
                className="form-input"
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          {/* ROW 2 */}
          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input
              type="email"
              name="email"
              placeholder="john.doe@example.com"
              value={formData.email}
              onChange={handleChange}
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Confirm Password</label>
            <div className="input-wrapper">
              <input
                type={showConfirmPassword ? "text" : "password"}
                name="confirmPassword"
                placeholder="Confirm your password"
                value={formData.confirmPassword}
                onChange={handleChange}
                className="form-input"
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          {/* ROW 3 */}
          <div className="form-group">
            <label className="form-label">Contact Number</label>
            <input
              type="tel"
              name="contactNumber"
              placeholder="+92 3XX-XXXXXXX"
              value={formData.contactNumber}
              onChange={handleChange}
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Years of Experience</label>
            <input
              type="number"
              name="years_of_experience"
              placeholder="e.g., 5"
              value={formData.years_of_experience}
              onChange={handleChange}
              className="form-input"
            />
          </div>

          {/* ROW 4 */}
          <div className="form-group">
            <label className="form-label">Department</label>
            <input
              type="text"
              name="department"
              placeholder="e.g., Cybercrime Unit"
              value={formData.department}
              onChange={handleChange}
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Certification</label>
            <input
              type="text"
              name="certification"
              placeholder="e.g., CFE"
              value={formData.certification}
              onChange={handleChange}
              className="form-input"
            />
          </div>

          {/* ROW 5 (FULL WIDTH) */}
          <div className="form-group full-width">
            <label className="form-label">Specialization *</label>
            <input
              type="text"
              name="specialization"
              placeholder="e.g., Digital Forensics"
              value={formData.specialization}
              onChange={handleChange}
              className="form-input"
              required
            />
          </div>
        </div>{" "}
           {" "}
        <button type="submit" className="submit-button" disabled={isLoading}>
               {" "}
          {isLoading ? (
            "Creating Account..."
          ) : (
            <>
              Create Account <ArrowRight size={20} />
            </>
          )}
             {" "}
        </button>
           {" "}
        <div className="form-footer">
               {" "}
          <p className="footer-text">
                    Already have an account?{" "}
            <span className="footer-link" onClick={() => navigate("/login")}>
              Sign In
            </span>
                 {" "}
          </p>
             {" "}
        </div>{" "}
      </form>
    </div>
  );
}
