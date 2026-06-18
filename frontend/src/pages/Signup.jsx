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
  Upload,
  X,
} from "lucide-react";
import { signup } from "../services/api";
import "./Signup.css";

// ── VALIDATION HELPERS ──────────────────────────────────────────────────────

// Phone: digits, spaces, dashes, and a leading + only (no letters/symbols)
const PHONE_CHARS_PATTERN = /^[0-9+\-\s]*$/;
// Escaped for the HTML "pattern" attribute: some browsers parse pattern
// strings in regex "v-mode", where +, &, (, ), and - are treated as
// set-operation syntax unless explicitly escaped with a backslash.
const PHONE_HTML_PATTERN = "[0-9\\+ \\-]*";

const validatePakistaniPhone = (phone) => {
  if (!phone || phone.trim() === "") return true;
  const cleaned = phone.replace(/[\s\-]/g, ""); // remove spaces and dashes
  // Covers: 03XXXXXXXXX (11 digits), +923XXXXXXXXX, 00923XXXXXXXXX, 923XXXXXXXXX
  const pattern = /^(\+92|0092|92|0)3[0-9]{9}$/;
  return pattern.test(cleaned);
};

// Name: letters and spaces only
const NAME_PATTERN = /^[A-Za-z\s]+$/;
const NAME_HTML_PATTERN = "[A-Za-z ]+";

// Specialization / Department: letters, numbers, spaces, and basic punctuation
const ALPHANUMERIC_PUNCT_PATTERN = /^[A-Za-z0-9\s.,&'()-]+$/;
// Escaped for the HTML "pattern" attribute (see PHONE_HTML_PATTERN note above)
const ALPHANUMERIC_PUNCT_HTML_PATTERN = "[A-Za-z0-9 .,\\&'\\(\\)\\-]+";

// Standard email pattern (HTML5-style, used alongside type="email")
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMAIL_HTML_PATTERN = "[^\\s@]+@[^\\s@]+\\.[^\\s@]+";

const MAX_CERT_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_CERT_FILE_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
];

// FastAPI/Pydantic validation errors return `detail` as an array of
// {type, loc, msg, input} objects (422 responses) rather than a plain
// string. Rendering that array directly in JSX crashes React, so this
// normalizes any shape of `detail` into a displayable string.
const extractErrorMessage = (data, fallback) => {
  if (!data) return fallback;
  const { detail } = data;
  if (!detail) return fallback;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((err) => {
        if (typeof err === "string") return err;
        const field = Array.isArray(err.loc) ? err.loc[err.loc.length - 1] : "";
        return field ? `${field}: ${err.msg}` : err.msg;
      })
      .filter(Boolean)
      .join(" | ");
  }
  if (typeof detail === "object" && detail.msg) return detail.msg;
  return fallback;
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
    department: "",
  });
  const [certificationFile, setCertificationFile] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleCertificationFileChange = (e) => {
    const file = e.target.files?.[0] || null;
    setCertificationFile(file);
  };

  const removeCertificationFile = () => {
    setCertificationFile(null);
  };

  const validateForm = () => {
    if (!formData.name.trim())
      return setMessage({ type: "error", text: "Name is required" });
    if (!NAME_PATTERN.test(formData.name.trim()))
      return setMessage({
        type: "error",
        text: "Name can only contain letters and spaces",
      });

    if (!formData.email.trim())
      return setMessage({ type: "error", text: "Email is required" });
    if (!EMAIL_PATTERN.test(formData.email.trim()))
      return setMessage({ type: "error", text: "Please enter a valid email address" });

    if (formData.password.length < 6)
      return setMessage({
        type: "error",
        text: "Password must be at least 6 characters",
      });
    if (formData.password !== formData.confirmPassword)
      return setMessage({ type: "error", text: "Passwords do not match" });

    // Phone: character set check, then Pakistan format check
    if (formData.contactNumber && !PHONE_CHARS_PATTERN.test(formData.contactNumber))
      return setMessage({
        type: "error",
        text: "Phone number can only contain numbers, spaces, dashes, and +",
      });
    if (
      formData.contactNumber &&
      !validatePakistaniPhone(formData.contactNumber)
    )
      return setMessage({
        type: "error",
        text: "Invalid phone number. Use format: 03XX-XXXXXXX or +923XXXXXXXXX",
      });

    if (formData.role === "investigator") {
      if (!formData.specialization.trim())
        return setMessage({
          type: "error",
          text: "Specialization is required for investigators",
        });
      if (!ALPHANUMERIC_PUNCT_PATTERN.test(formData.specialization.trim()))
        return setMessage({
          type: "error",
          text: "Specialization can only contain letters, numbers, spaces, and basic punctuation",
        });

      if (formData.department && !ALPHANUMERIC_PUNCT_PATTERN.test(formData.department.trim()))
        return setMessage({
          type: "error",
          text: "Department can only contain letters, numbers, spaces, and basic punctuation",
        });

      if (
        formData.years_of_experience !== "" &&
        formData.years_of_experience !== null
      ) {
        const years = Number(formData.years_of_experience);
        if (!Number.isInteger(years) || years < 0 || years > 50)
          return setMessage({
            type: "error",
            text: "Years of experience must be a whole number between 0 and 50",
          });
      }

      // Certification is now a required file upload
      if (!certificationFile)
        return setMessage({
          type: "error",
          text: "Please upload a certification file",
        });
      if (!ALLOWED_CERT_FILE_TYPES.includes(certificationFile.type))
        return setMessage({
          type: "error",
          text: "Certification file must be a PDF, PNG, or JPEG",
        });
      if (certificationFile.size > MAX_CERT_FILE_SIZE)
        return setMessage({
          type: "error",
          text: "Certification file must be smaller than 10MB",
        });
    }

    setMessage({ type: "", text: "" });
    return true;
  };

  // Update the handleSubmit function in SignUp.jsx:

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    setIsLoading(true);

    try {
      // Certification is now a file, so we send the payload as FormData
      // instead of JSON whenever a certification file is attached.
      const payload = new FormData();
      payload.append("email", formData.email);
      payload.append("password", formData.password);
      payload.append("name", formData.name);
      payload.append("contact_number", formData.contactNumber);
      payload.append("role", formData.role);

      if (formData.role === "investigator") {
        payload.append("specialization", formData.specialization);
        payload.append(
          "years_of_experience",
          formData.years_of_experience ? String(parseInt(formData.years_of_experience, 10)) : ""
        );
        payload.append("department", formData.department || "");
        if (certificationFile) {
          payload.append("certification", certificationFile);
        }
      }

      const response = await signup(payload);
      let data = {};
      try {
        data = await response.json();
      } catch {
        data = {};
      }

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
          department: "",
        });
        setCertificationFile(null);

        // Only redirect non-investigators immediately
        if (formData.role !== "investigator") {
          setTimeout(() => navigate("/login"), 2000);
        }
      } else {
        setMessage({
          type: "error",
          text: extractErrorMessage(data, "Signup failed. Please try again."),
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
            <div className="auth-orb orb-1"></div>{" "}
        <div className="auth-orb orb-2"></div> {" "}
      </div>
        {/* Back Button moved here */} {" "}
      <button className="back-button" onClick={() => navigate("/")}>
            <ArrowLeft size={20} /> Back  {" "}
      </button>
        {/* The form now acts as the main card/content container */} {" "}
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
              pattern={NAME_HTML_PATTERN}
              title="Letters and spaces only"
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
                minLength={6}
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
              pattern={EMAIL_HTML_PATTERN}
              title="Enter a valid email address"
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
                minLength={6}
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
              pattern={PHONE_HTML_PATTERN}
              title="Numbers, spaces, dashes, and + only"
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
              min={0}
              max={50}
              step={1}
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
              pattern={ALPHANUMERIC_PUNCT_HTML_PATTERN}
              title="Letters, numbers, spaces, and basic punctuation only"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Certification *</label>
            <div className="file-upload-wrapper" style={{ position: "relative" }}>
              <input
                type="file"
                id="certification-file"
                name="certification"
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={handleCertificationFileChange}
                className="file-input-hidden"
                style={{
                  position: "absolute",
                  width: 1,
                  height: 1,
                  padding: 0,
                  margin: 0,
                  overflow: "hidden",
                  clip: "rect(0, 0, 0, 0)",
                  whiteSpace: "nowrap",
                  border: 0,
                }}
                required
              />
              <label htmlFor="certification-file" className="file-upload-label">
                <Upload size={18} />
                {certificationFile ? certificationFile.name : "Upload certification file"}
              </label>
              {certificationFile && (
                <button
                  type="button"
                  className="file-remove-button"
                  onClick={removeCertificationFile}
                  aria-label="Remove certification file"
                >
                  <X size={16} />
                </button>
              )}
            </div>
            <p className="form-hint">PDF, PNG, or JPEG, max 10MB</p>
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
              pattern={ALPHANUMERIC_PUNCT_HTML_PATTERN}
              title="Letters, numbers, spaces, and basic punctuation only"
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