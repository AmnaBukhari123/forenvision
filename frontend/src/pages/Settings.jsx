// pages/Settings.jsx
import React, { useState, useEffect } from 'react';
import { User, Key } from 'lucide-react';
import { BASE } from '../services/api';
import './Settings.css';

const API_URL = import.meta.env.VITE_API_URL || BASE;

export default function Settings() {
  const [activeTab, setActiveTab] = useState('profile');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  
  // Profile state
  const [profile, setProfile] = useState({
    name: '',
    email: '',
    contact_number: ''
  });
  
  // Password state
  const [passwords, setPasswords] = useState({
    current_password: '',
    new_password: '',
    confirm_password: ''
  });


  // ✅ Track original values to detect changes
  const [originalProfile, setOriginalProfile] = useState({
    name: '',
    email: '',
    contact_number: ''
  });

  const [originalPasswords] = useState({
    current_password: '',
    new_password: '',
    confirm_password: ''
  });

  // Load profile data
  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/v1/settings/profile`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        const loaded = {
          name: data.name || '',
          email: data.email || '',
          contact_number: data.contact_number || ''
        };
        setProfile(loaded);
        setOriginalProfile(loaded); // ✅ Save original
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    }
  };

  

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/v1/settings/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(profile)
      });

      if (res.ok) {
        setMessage({ type: 'success', text: 'Profile updated successfully!' });
        setOriginalProfile({ ...profile }); // ✅ Update original after save
        loadProfile();
      } else {
        const error = await res.json();
        setMessage({ type: 'error', text: error.detail || 'Failed to update profile' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'An error occurred. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    
    if (passwords.new_password !== passwords.confirm_password) {
      setMessage({ type: 'error', text: 'New passwords do not match' });
      return;
    }

    if (passwords.new_password.length < 6) {
      setMessage({ type: 'error', text: 'Password must be at least 6 characters' });
      return;
    }

    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/v1/settings/password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          current_password: passwords.current_password,
          new_password: passwords.new_password
        })
      });

      if (res.ok) {
        setMessage({ type: 'success', text: 'Password changed successfully!' });
        setPasswords({ current_password: '', new_password: '', confirm_password: '' });
      } else {
        const error = await res.json();
        setMessage({ type: 'error', text: error.detail || 'Failed to change password' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'An error occurred. Please try again.' });
    } finally {
      setLoading(false);
    }
  };



  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'security', label: 'Security', icon: Key },
  ];



  // ✅ Check if profile has any changes from original
  const profileHasChanges = 
    profile.name !== originalProfile.name ||
    profile.email !== originalProfile.email ||
    profile.contact_number !== originalProfile.contact_number;

  // ✅ Check if any password field is filled
  const passwordHasChanges =
    passwords.current_password.trim() !== '' ||
    passwords.new_password.trim() !== '' ||
    passwords.confirm_password.trim() !== '';

  return (
    <div className="settings-page">
      <div className="settings-header">
        <h1>Settings</h1>
        <p>Manage your account preferences</p>
      </div>

      {/* Tabs */}
      <div className="settings-tabs">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => {
                setActiveTab(tab.id);
                setMessage({ type: '', text: '' });
              }}
            >
              <Icon size={20} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Message Alert */}
      {message.text && (
        <div className={`message-alert ${message.type}`}>
          {message.text}
        </div>
      )}

      {/* Tab Content */}
      <div className="settings-content-area">
        {activeTab === 'profile' && (
          <div className="settings-section">
            <h2>Profile Information</h2>
            <p className="section-description">Update your personal information</p>
            
            <form onSubmit={handleProfileUpdate} className="settings-form">
              <div className="form-field">
                <label>Full Name</label>
                <input
                  type="text"
                  value={profile.name}
                  onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                  placeholder="Enter your full name"
                />
              </div>

              <div className="form-field">
                <label>Email Address</label>
                <input
                  type="email"
                  value={profile.email}
                  onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                  placeholder="your.email@example.com"
                />
              </div>

              <div className="form-field">
                <label>Contact Number</label>
                <input
                  type="tel"
                  value={profile.contact_number}
                  onChange={(e) => setProfile({ ...profile, contact_number: e.target.value })}
                  placeholder="+1 (555) 123-4567"
                />
              </div>

              <button 
                type="submit" 
                className="submit-button" 
                disabled={loading || !profileHasChanges}
                title={!profileHasChanges ? "No changes to save" : ""}
                style={{ opacity: !profileHasChanges ? 0.5 : 1, cursor: !profileHasChanges ? "not-allowed" : "pointer" }}
              >
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
            </form>
          </div>
        )}

        {activeTab === 'security' && (
          <div className="settings-section">
            <h2>Change Password</h2>
            <p className="section-description">Ensure your account is secure</p>
            
            <form onSubmit={handlePasswordChange} className="settings-form">
              <div className="form-field">
                <label>Current Password</label>
                <input
                  type="password"
                  value={passwords.current_password}
                  onChange={(e) => setPasswords({ ...passwords, current_password: e.target.value })}
                  placeholder="Enter current password"
                  required
                />
              </div>

              <div className="form-field">
                <label>New Password</label>
                <input
                  type="password"
                  value={passwords.new_password}
                  onChange={(e) => setPasswords({ ...passwords, new_password: e.target.value })}
                  placeholder="Enter new password"
                  required
                />
                <span className="field-hint">Minimum 6 characters</span>
              </div>

              <div className="form-field">
                <label>Confirm New Password</label>
                <input
                  type="password"
                  value={passwords.confirm_password}
                  onChange={(e) => setPasswords({ ...passwords, confirm_password: e.target.value })}
                  placeholder="Confirm new password"
                  required
                />
              </div>

              <button 
                type="submit" 
                className="submit-button" 
                disabled={loading || !passwordHasChanges}
                title={!passwordHasChanges ? "Enter password details first" : ""}
                style={{ opacity: !passwordHasChanges ? 0.5 : 1, cursor: !passwordHasChanges ? "not-allowed" : "pointer" }}
              >
                {loading ? 'Changing...' : 'Change Password'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}