// pages/Settings.jsx
import React, { useState, useEffect } from 'react';
import { User, Key, Bell } from 'lucide-react';
import './Settings.css';
import { getNotificationPreferences, updateNotificationPreferences, handleApiResponse } from '../services/api';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

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

  // Notification preferences state
  const [notifications, setNotifications] = useState({
    email_notifications: true,
    case_updates: true,
    new_assignments: true,
    system_announcements: false
  });
  const [notificationsLoading, setNotificationsLoading] = useState(false);

  // Load profile data
  useEffect(() => {
    loadProfile();
    loadNotifications();
  }, []);

  const loadProfile = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/settings/profile`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (res.ok) {
        const data = await res.json();
        setProfile({
          name: data.name || '',
          email: data.email || '',
          contact_number: data.contact_number || ''
        });
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    }
  };

  const loadNotifications = async () => {
    try {
      setNotificationsLoading(true);
      const response = await getNotificationPreferences();
      const data = await handleApiResponse(response);
      setNotifications(data);
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setNotificationsLoading(false);
    }
  };

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/settings/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(profile)
      });

      if (res.ok) {
        setMessage({ type: 'success', text: 'Profile updated successfully!' });
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
      const res = await fetch(`${API_URL}/settings/password`, {
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

  const handleNotificationToggle = async (key) => {
    const newValue = !notifications[key];
    
    // Optimistically update UI
    setNotifications(prev => ({ ...prev, [key]: newValue }));
    setMessage({ type: '', text: '' });

    try {
      const response = await updateNotificationPreferences({ [key]: newValue });
      await handleApiResponse(response);
      setMessage({ type: 'success', text: 'Notification preferences updated!' });
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    } catch (error) {
      // Revert on error
      setNotifications(prev => ({ ...prev, [key]: !newValue }));
      setMessage({ type: 'error', text: error.message || 'Failed to update preferences' });
    }
  };

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'security', label: 'Security', icon: Key },
    { id: 'notifications', label: 'Notifications', icon: Bell }
  ];

  const notificationOptions = [
    {
      key: 'email_notifications',
      title: 'Email Notifications',
      description: 'Receive email updates about case activities'
    },
    {
      key: 'case_updates',
      title: 'Case Updates',
      description: 'Get notified when cases are updated'
    },
    {
      key: 'new_assignments',
      title: 'New Assignments',
      description: "Alert when you're assigned to a new case"
    },
    {
      key: 'system_announcements',
      title: 'System Announcements',
      description: 'Receive important system updates'
    }
  ];

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

              <button type="submit" className="submit-button" disabled={loading}>
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

              <button type="submit" className="submit-button" disabled={loading}>
                {loading ? 'Changing...' : 'Change Password'}
              </button>
            </form>
          </div>
        )}

        {activeTab === 'notifications' && (
          <div className="settings-section">
            <h2>Notification Preferences</h2>
            <p className="section-description">Manage how you receive updates</p>
            
            {notificationsLoading ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#9ca3af' }}>
                Loading preferences...
              </div>
            ) : (
              <div className="notification-options">
                {notificationOptions.map(option => (
                  <div key={option.key} className="notification-item">
                    <div className="notification-info">
                      <h3>{option.title}</h3>
                      <p>{option.description}</p>
                    </div>
                    <label className="toggle-switch">
                      <input 
                        type="checkbox" 
                        checked={notifications[option.key]}
                        onChange={() => handleNotificationToggle(option.key)}
                      />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}