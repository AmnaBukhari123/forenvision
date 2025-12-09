// services/api.js
const BASE = "http://127.0.0.1:8000";

// Flag to prevent alert during intentional logout
let isLoggingOut = false;

// Helper to dispatch auth change events
const dispatchAuthChange = () => {
  window.dispatchEvent(new Event('authChange'));
};

// Helper function to get token from localStorage
const getToken = () => {
  return localStorage.getItem('token');
};

// Helper function to make authenticated requests
const authFetch = async (url, options = {}) => {
  const token = getToken();
  
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(`${BASE}${url}`, {
      ...options,
      headers,
    });

    if (response.status === 401) {
      console.error('Authentication failed - clearing session');
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      dispatchAuthChange();
      
      // Only show alert if this is NOT an intentional logout
      if (!isLoggingOut) {
        alert('Your session has expired. Please log in again.');
      }
      
      window.location.href = '/login';
      throw new Error('Authentication failed');
    }

    if (response.status === 403) {
      console.error('Access forbidden - your session may be outdated. Please log in again.');
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      dispatchAuthChange();
      
      // Only show alert if this is NOT an intentional logout
      if (!isLoggingOut) {
        alert('Your session is outdated. Please log in again.');
      }
      
      window.location.href = '/login';
      throw new Error('Access forbidden');
    }

    return response;
  } catch (error) {
    console.error('API request failed:', error);
    throw error;
  }
};

// For file uploads (FormData)
const authFetchFormData = async (url, formData) => {
  const token = getToken();
  
  const headers = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(`${BASE}${url}`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (response.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      dispatchAuthChange();
      
      if (!isLoggingOut) {
        alert('Your session has expired. Please log in again.');
      }
      
      window.location.href = '/login';
      throw new Error('Authentication failed');
    }

    return response;
  } catch (error) {
    console.error('API request failed:', error);
    throw error;
  }
};

// =============== CASE ENDPOINTS ===============
export async function createCase(payload) {
  const res = await authFetch('/api/v1/cases', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return res;
}

export async function listCases(params = {}) {
  const qs = new URLSearchParams(params).toString();
  const res = await authFetch(`/api/v1/cases${qs ? '?' + qs : ''}`);
  return res;
}

export async function updateCase(caseId, updates) {
  const res = await authFetch(`/api/v1/cases/${caseId}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  });
  return res;
}

export async function getCase(caseId) {
  const res = await authFetch(`/api/v1/cases/${caseId}`);
  return res;
}

export async function deleteCase(caseId) {
  const res = await authFetch(`/api/v1/cases/${caseId}`, { 
    method: 'DELETE' 
  });
  return res;
}

export async function acceptCase(caseId, acceptanceData) {
  const res = await authFetch(`/api/v1/cases/${caseId}/accept`, {
    method: 'POST',
    body: JSON.stringify(acceptanceData),
  });
  return res;
}

export async function uploadEvidence(caseId, file) {
  const formData = new FormData();
  formData.append('file', file);
  const res = await authFetchFormData(`/api/v1/cases/${caseId}/evidence`, formData);
  return res;
}

export async function deleteEvidence(evidenceId) {
  const res = await authFetch(`/api/v1/evidence/${evidenceId}`, {
    method: 'DELETE',
  });
  return res;
}

// =============== WITNESS STATEMENT ENDPOINTS ===============
export async function getWitnessStatements(caseId) {
  const res = await authFetch(`/api/v1/cases/${caseId}/witness-statements`);
  return res;
}

export async function addWitnessStatement(caseId, witnessData) {
  const res = await authFetch(`/api/v1/cases/${caseId}/witness-statements`, {
    method: 'POST',
    body: JSON.stringify(witnessData),
  });
  return res;
}

export async function updateWitnessStatement(statementId, witnessData) {
  const res = await authFetch(`/api/v1/witness-statements/${statementId}`, {
    method: 'PUT',
    body: JSON.stringify(witnessData),
  });
  return res;
}

export async function deleteWitnessStatement(statementId) {
  const res = await authFetch(`/api/v1/witness-statements/${statementId}`, {
    method: 'DELETE',
  });
  return res;
}

// =============== OBJECT DETECTION ENDPOINTS ===============

/**
 * Run object detection on evidence images
 * @param {number} caseId - The case ID
 * @param {Object} options - Detection options
 * @param {number} [options.evidenceId] - Specific evidence ID (optional)
 * @param {string} [options.modelType] - Model type: "crime_scene" or "blood" (default: "crime_scene")
 * @param {number} [options.confThreshold] - Confidence threshold (default: 0.25)
 */
export async function runObjectDetection(caseId, options = {}) {
  const { evidenceId = null, modelType = "crime_scene", confThreshold = 0.25 } = options;
  
  const payload = {
    model_type: modelType,
    conf_threshold: confThreshold,
  };
  
  if (evidenceId) {
    payload.evidence_id = evidenceId;
  }

  const res = await authFetch(`/api/v1/cases/${caseId}/run_object_detection`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return res;
}

/**
 * Get object detection results for a case
 * @param {number} caseId - The case ID
 * @param {string} [modelType] - Filter by model type: "crime_scene" or "blood" (optional)
 */
export async function getObjectDetectionResults(caseId, modelType = null) {
  let url = `/api/v1/cases/${caseId}/object_detection_results`;
  
  if (modelType) {
    url += `?model_type=${encodeURIComponent(modelType)}`;
  }
  
  const res = await authFetch(url);
  return res;
}

export async function getDetectionResult(resultId) {
  const res = await authFetch(`/api/v1/object_detection_results/${resultId}`);
  return res;
}

export async function deleteDetectionResult(resultId) {
  const res = await authFetch(`/api/v1/object_detection_results/${resultId}`, {
    method: 'DELETE',
  });
  return res;
}

/**
 * Delete detection results for a case
 * @param {number} caseId - The case ID
 * @param {string} [modelType] - Delete only results from specific model (optional)
 */
export async function deleteAllCaseDetectionResults(caseId, modelType = null) {
  let url = `/api/v1/cases/${caseId}/object_detection_results`;
  
  if (modelType) {
    url += `?model_type=${encodeURIComponent(modelType)}`;
  }
  
  const res = await authFetch(url, {
    method: 'DELETE',
  });
  return res;
}

/**
 * Get information about available detection models
 */
export async function getModelsInfo() {
  const res = await authFetch('/api/v1/models/info');
  return res;
}

// =============== 3D MODEL ENDPOINTS ===============
export async function create3d(caseId) {
  const res = await authFetch(`/api/v1/cases/${caseId}/create_3d`, { 
    method: 'POST' 
  });
  return res;
}

// =============== SETTINGS ENDPOINTS ===============
export async function getProfile() {
  const res = await authFetch('/api/v1/settings/profile');
  return res;
}

export async function updateProfile(profileData) {
  const res = await authFetch('/api/v1/settings/profile', {
    method: 'PUT',
    body: JSON.stringify(profileData),
  });
  return res;
}

export async function uploadProfilePicture(file) {
  const formData = new FormData();
  formData.append('file', file);
  const res = await authFetchFormData('/api/v1/settings/profile/picture', formData);
  return res;
}

export async function changePassword(passwordData) {
  const res = await authFetch('/api/v1/settings/password', {
    method: 'POST',
    body: JSON.stringify(passwordData),
  });
  return res;
}

export async function setup2FA(twoFAData) {
  const res = await authFetch('/api/v1/settings/2fa/setup', {
    method: 'POST',
    body: JSON.stringify(twoFAData),
  });
  return res;
}

export async function verify2FA(tokenData) {
  const res = await authFetch('/api/v1/settings/2fa/verify', {
    method: 'POST',
    body: JSON.stringify(tokenData),
  });
  return res;
}

export async function getApplicationSettings() {
  const res = await authFetch('/api/v1/settings/application');
  return res;
}

export async function updateApplicationSettings(settings) {
  const res = await authFetch('/api/v1/settings/application', {
    method: 'PUT',
    body: JSON.stringify(settings),
  });
  return res;
}

export async function getCaseManagementSettings() {
  const res = await authFetch('/api/v1/settings/case-management');
  return res;
}

export async function updateCaseManagementSettings(settings) {
  const res = await authFetch('/api/v1/settings/case-management', {
    method: 'PUT',
    body: JSON.stringify(settings),
  });
  return res;
}

export async function getAllSettings() {
  const res = await authFetch('/api/v1/settings/all');
  return res;
}

export async function getNotificationPreferences() {
  const res = await authFetch('/api/v1/settings/notifications');
  return res;
}

export async function updateNotificationPreferences(preferences) {
  const res = await authFetch('/api/v1/settings/notifications', {
    method: 'PUT',
    body: JSON.stringify(preferences),
  });
  return res;
}

// =============== AUTH ENDPOINTS ===============
export async function login(email, password) {
  const res = await fetch(`${BASE}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  
  if (res.ok) {
    const data = await res.json();
    // Store token and user
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    dispatchAuthChange(); // Notify app immediately
  }
  
  return res;
}

export async function signup(userData) {
  const res = await fetch(`${BASE}/api/v1/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(userData),
  });
  return res;
}

// =============== CONTACT FORM ENDPOINTS ===============
export async function submitContactRequest(formData) {
  const res = await fetch(`${BASE}/api/v1/contact/submit`, {
    method: 'POST',
    body: formData,
  });
  return res;
}

export async function checkRequestStatus(requestId, email) {
  const res = await fetch(`${BASE}/api/v1/contact/status/${requestId}?email=${encodeURIComponent(email)}`);
  return res;
}

// =============== ADMIN ENDPOINTS ===============

// Dashboard Stats
export async function getAdminDashboardStats() {
  const res = await authFetch('/api/v1/admin/dashboard/stats');
  return res;
}

// Contact Requests Management
export async function getContactRequests(params = {}) {
  const qs = new URLSearchParams(params).toString();
  const res = await authFetch(`/api/v1/admin/contact-requests${qs ? '?' + qs : ''}`);
  return res;
}

export async function getContactRequest(requestId) {
  const res = await authFetch(`/api/v1/admin/contact-requests/${requestId}`);
  return res;
}

export async function updateContactRequest(requestId, updateData) {
  const res = await authFetch(`/api/v1/admin/contact-requests/${requestId}`, {
    method: 'PUT',
    body: JSON.stringify(updateData),
  });
  return res;
}

export async function convertContactRequestToCase(requestId, conversionData) {
  const res = await authFetch(`/api/v1/admin/contact-requests/${requestId}/convert-to-case`, {
    method: 'POST',
    body: JSON.stringify(conversionData),
  });
  return res;
}

export async function deleteContactRequest(requestId) {
  const res = await authFetch(`/api/v1/admin/contact-requests/${requestId}`, {
    method: 'DELETE',
  });
  return res;
}

// Investigator Management
export const getInvestigators = async () => {
  const token = localStorage.getItem('token');
  return fetch(`${BASE}/api/v1/admin/investigators`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
};

export const getInvestigatorDetails = async (investigatorId) => {
  const token = localStorage.getItem('token');
  return fetch(`${BASE}/api//v1/admin/investigators/${investigatorId}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
};

export const updateInvestigator = async (investigatorId, data) => {
  const token = localStorage.getItem('token');
  return fetch(`${BASE}/api//v1/admin/investigators/${investigatorId}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  });
};

export const updateInvestigatorAvailability = async (isAvailable) => {
  const token = getToken();
  return fetch(`${BASE}/api/v1/investigator/availability`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ is_available: isAvailable })
  });
};

// User Management
export async function getAllUsers(params = {}) {
  const qs = new URLSearchParams(params).toString();
  const res = await authFetch(`/api/v1/admin/users${qs ? '?' + qs : ''}`);
  return res;
}

export async function updateUserRole(userId, role) {
  const res = await authFetch(`/api/v1/admin/users/${userId}/role?role=${encodeURIComponent(role)}`, {
    method: 'PUT',
  });
  return res;
}

// Cases Overview (Admin view of all cases)
export async function getAdminCases(params = {}) {
  const qs = new URLSearchParams(params).toString();
  const res = await authFetch(`/api/v1/admin/cases${qs ? '?' + qs : ''}`);
  return res;
}

// =============== UTILITY FUNCTIONS ===============

// Check if user is authenticated
export function isAuthenticated() {
  return !!getToken();
}

// Get current user from localStorage
export const getCurrentUser = () => {
  const userStr = localStorage.getItem('user');
  return userStr ? JSON.parse(userStr) : null;
};

// Check if user is admin
export function isAdmin() {
  const user = getCurrentUser();
  return user && user.role === 'admin';
}

// Check if user is investigator
export function isInvestigator() {
  const user = getCurrentUser();
  return user && user.role === 'investigator';
}

// Logout function - FIXED to prevent double alert
export function logout() {
  isLoggingOut = true; // Set flag to prevent alerts
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  dispatchAuthChange();
  window.location.href = '/login';
  // Reset flag after a short delay (in case redirect is slow)
  setTimeout(() => {
    isLoggingOut = false;
  }, 1000);
}

// Update user in localStorage
export function updateStoredUser(userData) {
  const currentUser = getCurrentUser();
  if (currentUser) {
    const updatedUser = { ...currentUser, ...userData };
    localStorage.setItem('user', JSON.stringify(updatedUser));
    dispatchAuthChange();
  }
}

// Error handler for API responses
export async function handleApiResponse(response) {
  if (!response.ok) {
    let errorMessage = 'An error occurred';
    try {
      const errorData = await response.json();
      errorMessage = errorData.detail || errorData.message || errorMessage;
    } catch (e) {
      errorMessage = `HTTP ${response.status}: ${response.statusText}`;
    }
    throw new Error(errorMessage);
  }
  return response.json();
}

// Generic API call with error handling
export async function apiCall(url, options = {}) {
  try {
    const response = await authFetch(url, options);
    return await handleApiResponse(response);
  } catch (error) {
    console.error('API call failed:', error);
    throw error;
  }
}