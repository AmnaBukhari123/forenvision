import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createCase } from "../services/api";
import "./CreateCase.css";

export default function CreateCase() {
  const navigate = useNavigate();

  // Visual Case ID (for UI only) - REMOVED since we don't generate it on frontend
  const [caseId, setCaseId] = useState("Generating...");
  const [isLoading, setIsLoading] = useState(false);

  const [form, setForm] = useState({
    name: "",
    description: "",
    investigating_officer: "",
    incident_date: "",
    category: "",
    priority: "",
    client: "",
    tags: "",
  });

  // Check if user is authenticated on component mount
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      alert('Please login first');
      navigate('/login');
      return;
    }
  }, [navigate]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSave = async (openAfter = false) => {
    console.log("Saving case:", form);
    
    // Check if token exists
    const token = localStorage.getItem('token');
    if (!token) {
      alert('Please login first');
      navigate('/login');
      return;
    }

    setIsLoading(true);

    try {
      const response = await createCase({
        name: form.name,
        description: form.description,
        incident_date: form.incident_date || null,
        category: form.category,
        priority: form.priority,
        client: form.client,
        investigating_officer: form.investigating_officer,
      });

      if (!response.ok) {
        if (response.status === 401) {
          alert('Session expired. Please login again.');
          localStorage.removeItem('token');
          navigate('/login');
          return;
        }
        if (response.status === 403) {
          alert('Access forbidden. Please check your permissions.');
          return;
        }
        throw new Error(`Server error: ${response.status}`);
      }

      const data = await response.json();
      console.log("Case created:", data);

      // ✅ Use numeric ID from backend response
      const newCaseId = data.case.id;

      if (openAfter) {
        navigate(`/dashboard/cases/${newCaseId}`);
      } else {
        navigate("/dashboard/cases");
      }
    } catch (err) {
      console.error("Failed to save case:", err);
      if (err.message !== 'Authentication failed') {
        alert("Error saving case. Check backend logs.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="createcase-container">
      <h2>Create New Case</h2>
      <form className="createcase-form" onSubmit={(e) => e.preventDefault()}>
        {/* Case Identification */}
        <div className="form-section">
          <h3>Case Identification</h3>
          <div className="form-group">
            <label>Case ID (Auto-generated)</label>
            <input type="text" value="Auto-generated after save" disabled />
          </div>
          <div className="form-group">
            <label>Case Name *</label>
            <input 
              name="name" 
              value={form.name} 
              onChange={handleChange} 
              placeholder="Enter case name" 
              required 
            />
          </div>
          <div className="form-group">
            <label>Description</label>
            <textarea 
              name="description" 
              value={form.description} 
              onChange={handleChange} 
              placeholder="Enter description" 
            />
          </div>
        </div>

        {/* Case Details */}
        <div className="form-section">
          <h3>Case Details</h3>
          <div className="form-row">
            <div className="form-group">
              <label>Date of Incident</label>
              <input type="date" name="incident_date" value={form.incident_date} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label>Category</label>
              <select name="category" value={form.category} onChange={handleChange}>
                <option value="">Select</option>
                <option>Theft</option>
                <option>Cybercrime</option>
                <option>Accident Reconstruction</option>
                <option>General</option>
              </select>
            </div>
            <div className="form-group">
              <label>Priority</label>
              <select name="priority" value={form.priority} onChange={handleChange}>
                <option value="">Select</option>
                <option>Low</option>
                <option>Medium</option>
                <option>High</option>
                <option>Critical</option>
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Client/Department</label>
              <input name="client" value={form.client} onChange={handleChange} placeholder="Enter client or department" />
            </div>
            <div className="form-group">
              <label>Tags (comma-separated)</label>
              <input name="tags" value={form.tags} onChange={handleChange} placeholder="e.g. CCTV, 3D, Object Detection" />
            </div>
          </div>
        </div>

        {/* Administrative */}
        <div className="form-section">
          <h3>Administrative</h3>
          <div className="form-group">
            <label>Investigating Officer</label>
            <input
              name="investigating_officer"
              value={form.investigating_officer}
              onChange={handleChange}
              placeholder="Enter officer name"
            />
          </div>
        </div>

        {/* Buttons */}
        <div className="form-buttons">
          <button 
            type="button" 
            onClick={() => handleSave(false)} 
            className="save-btn"
            disabled={isLoading}
          >
            {isLoading ? 'Saving...' : 'Save'}
          </button>
          <button 
            type="button" 
            onClick={() => handleSave(true)} 
            className="saveopen-btn"
            disabled={isLoading}
          >
            {isLoading ? 'Saving...' : 'Save & Open'}
          </button>
          <button 
            type="button" 
            onClick={() => navigate("/dashboard/cases")} 
            className="cancel-btn"
            disabled={isLoading}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}