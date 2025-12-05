import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Shield, Mail, Phone, MessageSquare, Upload, X, CheckCircle, AlertCircle, FileText, File } from "lucide-react";
import { submitContactRequest } from "../services/api";
import "./Contact.css";

export default function Contact() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    subject: "",
    message: ""
  });
  const [files, setFiles] = useState([]);
  const [filePreviews, setFilePreviews] = useState([]);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [isLoading, setIsLoading] = useState(false);
  const [requestId, setRequestId] = useState(null);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const isImageFile = (file) => {
    return file.type.startsWith('image/');
  };

  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files);
    
    // Create previews for new files
    const newPreviews = selectedFiles.map(file => {
      if (isImageFile(file)) {
        return {
          file: file,
          url: URL.createObjectURL(file),
          isImage: true
        };
      } else {
        return {
          file: file,
          url: null,
          isImage: false
        };
      }
    });

    setFiles([...files, ...selectedFiles]);
    setFilePreviews([...filePreviews, ...newPreviews]);
  };

  const removeFile = (index) => {
    // Revoke the object URL to free memory
    if (filePreviews[index]?.url) {
      URL.revokeObjectURL(filePreviews[index].url);
    }
    
    setFiles(files.filter((_, i) => i !== index));
    setFilePreviews(filePreviews.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage({ type: "", text: "" });
    setIsLoading(true);

    try {
      const submitFormData = new FormData();
      submitFormData.append('name', formData.name);
      submitFormData.append('email', formData.email);
      submitFormData.append('phone', formData.phone);
      submitFormData.append('subject', formData.subject);
      submitFormData.append('message', formData.message);

      // Append files
      files.forEach((file) => {
        submitFormData.append('files', file);
      });

      const response = await submitContactRequest(submitFormData);
      const data = await response.json();

      if (response.ok) {
        setMessage({ 
          type: "success", 
          text: "Request submitted successfully! Our team will review it shortly." 
        });
        setRequestId(data.request_id);
        
        // Clean up object URLs
        filePreviews.forEach(preview => {
          if (preview.url) {
            URL.revokeObjectURL(preview.url);
          }
        });
        
        // Reset form
        setFormData({
          name: "",
          email: "",
          phone: "",
          subject: "",
          message: ""
        });
        setFiles([]);
        setFilePreviews([]);
      } else {
        setMessage({ 
          type: "error", 
          text: data.detail || "Failed to submit request. Please try again." 
        });
      }
    } catch (error) {
      setMessage({ 
        type: "error", 
        text: "Error connecting to server. Please try again." 
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getFileIcon = (fileName) => {
    const ext = fileName.split('.').pop().toLowerCase();
    if (['pdf'].includes(ext)) {
      return <FileText size={20} className="file-icon-preview" />;
    }
    return <File size={20} className="file-icon-preview" />;
  };

  return (
    <div className="contact-container">
      {/* Navbar */}
      <nav className="contact-navbar">
        <div className="navbar-content">
          <Link to="/" className="logo-container">
            <Shield className="logo-icon" size={28} />
            <h1 className="landing-logo">ForenVision</h1>
          </Link>
          <div className="nav-links">
            <Link to="/login" className="btn btn-login">
              Login
            </Link>
            <Link to="/signup" className="btn btn-signup">
              Sign Up
            </Link>
          </div>
        </div>
      </nav>

      {/* Contact Form Section */}
      <section className="contact-section">
        <div className="contact-content">
          <div className="contact-header">
            <h1 className="contact-title">Get in Touch</h1>
            <p className="contact-subtitle">
              Need forensic investigation services? Submit your request and our team will get back to you.
            </p>
          </div>

          <div className="contact-form-wrapper">
            <form onSubmit={handleSubmit} className="contact-form">
              {message.text && (
                <div className={`form-message ${message.type}`}>
                  {message.type === "success" ? (
                    <CheckCircle size={20} />
                  ) : (
                    <AlertCircle size={20} />
                  )}
                  <span>{message.text}</span>
                  {requestId && (
                    <p className="request-id">Request ID: #{requestId}</p>
                  )}
                </div>
              )}

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">
                    <Mail size={18} />
                    Full Name *
                  </label>
                  <input
                    type="text"
                    name="name"
                    placeholder="John Doe"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    className="form-input"
                    disabled={isLoading}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">
                    <Mail size={18} />
                    Email Address *
                  </label>
                  <input
                    type="email"
                    name="email"
                    placeholder="john@example.com"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    className="form-input"
                    disabled={isLoading}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">
                    <Phone size={18} />
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    placeholder="+1 (555) 123-4567"
                    value={formData.phone}
                    onChange={handleChange}
                    className="form-input"
                    disabled={isLoading}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">
                    <MessageSquare size={18} />
                    Subject *
                  </label>
                  <input
                    type="text"
                    name="subject"
                    placeholder="Investigation Request"
                    value={formData.subject}
                    onChange={handleChange}
                    required
                    className="form-input"
                    disabled={isLoading}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">
                  <MessageSquare size={18} />
                  Message *
                </label>
                <textarea
                  name="message"
                  placeholder="Please describe the nature of your investigation request and any relevant details..."
                  value={formData.message}
                  onChange={handleChange}
                  required
                  className="form-textarea"
                  disabled={isLoading}
                  rows={6}
                />
              </div>

              <div className="form-group">
                <label className="form-label">
                  <Upload size={18} />
                  Upload Evidence (Optional)
                </label>
                <div className="file-upload-area">
                  <input
                    type="file"
                    id="file-input"
                    multiple
                    onChange={handleFileChange}
                    className="file-input"
                    disabled={isLoading}
                    accept="image/*,.pdf,.doc,.docx,.zip"
                  />
                  <label htmlFor="file-input" className="file-upload-label">
                    <Upload size={24} />
                    <span>Click to upload files</span>
                    <span className="file-hint">Images, PDFs, Documents (Max 10MB each)</span>
                  </label>
                </div>

                {filePreviews.length > 0 && (
                  <div className="uploaded-files-preview">
                    {filePreviews.map((preview, index) => (
                      <div key={index} className="file-preview-item">
                        <div className="file-preview-content">
                          {preview.isImage ? (
                            <div className="image-preview-wrapper">
                              <img 
                                src={preview.url} 
                                alt={preview.file.name}
                                className="image-preview"
                              />
                            </div>
                          ) : (
                            <div className="file-icon-wrapper">
                              {getFileIcon(preview.file.name)}
                            </div>
                          )}
                          <div className="file-info">
                            <span className="file-name" title={preview.file.name}>
                              {preview.file.name}
                            </span>
                            <span className="file-size">
                              {(preview.file.size / 1024).toFixed(2)} KB
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeFile(index)}
                          className="remove-file-btn"
                          disabled={isLoading}
                          aria-label="Remove file"
                        >
                          <X size={18} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button type="submit" className="submit-button" disabled={isLoading}>
                {isLoading ? (
                  <span className="button-loading">Submitting...</span>
                ) : (
                  <>
                    Submit Request
                    <Mail size={20} />
                  </>
                )}
              </button>
            </form>

            {/* Info Sidebar */}
            <div className="contact-info">
              <h3>What Happens Next?</h3>
              <div className="info-steps">
                <div className="info-step">
                  <div className="step-number">1</div>
                  <div className="step-content">
                    <h4>Review</h4>
                    <p>Our admin team reviews your request within 24 hours</p>
                  </div>
                </div>
                <div className="info-step">
                  <div className="step-number">2</div>
                  <div className="step-content">
                    <h4>Assignment</h4>
                    <p>We assign a qualified investigator to your case</p>
                  </div>
                </div>
                <div className="info-step">
                  <div className="step-number">3</div>
                  <div className="step-content">
                    <h4>Contact</h4>
                    <p>Your investigator will reach out to discuss next steps</p>
                  </div>
                </div>
              </div>

              <div className="info-note">
                <AlertCircle size={20} />
                <p>
                  Save your <strong>Request ID</strong> to track your submission status.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="contact-footer">
        <div className="footer-content">
          <div className="footer-brand">
            <Shield size={24} />
            <span>ForenVision</span>
          </div>
          <p className="footer-text">
            © 2024 ForenVision. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}

