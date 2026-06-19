// services/api.js
export const BASE = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

let isLoggingOut = false;

const dispatchAuthChange = () => {
  window.dispatchEvent(new Event('authChange'));
};

const getToken = () => {
  return localStorage.getItem('token');
};

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
  return authFetch('/api/v1/cases', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function listCases(params = {}) {
  const qs = new URLSearchParams(params).toString();
  return authFetch(`/api/v1/cases${qs ? '?' + qs : ''}`);
}

export async function updateCase(caseId, updates) {
  return authFetch(`/api/v1/cases/${caseId}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  });
}

export async function getCase(caseId) {
  return authFetch(`/api/v1/cases/${caseId}`);
}

export async function deleteCase(caseId) {
  return authFetch(`/api/v1/cases/${caseId}`, { method: 'DELETE' });
}

export async function acceptCase(caseId, acceptanceData) {
  return authFetch(`/api/v1/cases/${caseId}/accept`, {
    method: 'POST',
    body: JSON.stringify(acceptanceData),
  });
}

export async function uploadEvidence(caseId, file) {
  const formData = new FormData();
  formData.append('file', file);
  return authFetchFormData(`/api/v1/cases/${caseId}/evidence`, formData);
}

export async function deleteEvidence(evidenceId) {
  return authFetch(`/api/v1/evidence/${evidenceId}`, { method: 'DELETE' });
}

// =============== WITNESS STATEMENT ENDPOINTS ===============
export async function getWitnessStatements(caseId) {
  return authFetch(`/api/v1/cases/${caseId}/witness-statements`);
}

export async function addWitnessStatement(caseId, witnessData) {
  return authFetch(`/api/v1/cases/${caseId}/witness-statements`, {
    method: 'POST',
    body: JSON.stringify(witnessData),
  });
}

export async function updateWitnessStatement(statementId, witnessData) {
  return authFetch(`/api/v1/witness-statements/${statementId}`, {
    method: 'PUT',
    body: JSON.stringify(witnessData),
  });
}

export async function deleteWitnessStatement(statementId) {
  return authFetch(`/api/v1/witness-statements/${statementId}`, { method: 'DELETE' });
}

// =============== OBJECT DETECTION ENDPOINTS ===============
export async function runObjectDetection(caseId, options = {}) {
  const { evidenceId = null, confThreshold = 0.25 } = options;
  
  const payload = {
    conf_threshold: confThreshold,
  };
  
  if (evidenceId) {
    payload.evidence_id = evidenceId;
  }

  return authFetch(`/api/v1/cases/${caseId}/run_object_detection`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function getObjectDetectionResults(caseId) {
  return authFetch(`/api/v1/cases/${caseId}/object_detection_results`);
}

export async function getDetectionResult(resultId) {
  return authFetch(`/api/v1/object_detection_results/${resultId}`);
}

export async function deleteDetectionResult(resultId) {
  return authFetch(`/api/v1/object_detection_results/${resultId}`, { method: 'DELETE' });
}

export async function deleteAllCaseDetectionResults(caseId) {
  const url = `/api/v1/cases/${caseId}/object_detection_results`;

  return authFetch(url, { method: 'DELETE' });
}

export async function getModelsInfo() {
  return authFetch('/api/v1/models/info');
}

// =============== REPORT ENDPOINTS ===============
export async function generateCaseReport(caseId) {
  return authFetch(`/api/v1/cases/${caseId}/report`);
}

export async function listCaseReports(caseId) {
  return authFetch(`/api/v1/cases/${caseId}/reports`);
}

export async function deleteCaseReport(reportId) {
  return authFetch(`/api/v1/reports/${reportId}`, { method: 'DELETE' });
}

// =============== 3D RECONSTRUCTION ENDPOINTS ===============
export async function listCaseImages(caseId) {
  return authFetch(`/api/v1/reconstruction/case/${caseId}/images`);
}

export async function startReconstruction(caseId, imageFilename, imageFilepath, removeBg = true) {
  return authFetch('/api/v1/reconstruction/start', {
    method: 'POST',
    body: JSON.stringify({
      case_id: caseId,
      image_filename: imageFilename,
      image_filepath: imageFilepath,
      remove_bg: removeBg,
    }),
  });
}

export async function getReconstructionStatus(jobId) {
  return authFetch(`/api/v1/reconstruction/status/${jobId}`);
}

export async function listCaseJobs(caseId) {
  return authFetch(`/api/v1/reconstruction/case/${caseId}/jobs`);
}

export async function deleteReconstructionJob(jobId) {
  return authFetch(`/api/v1/reconstruction/jobs/${jobId}`, { method: 'DELETE' });
}

// =============== SETTINGS ENDPOINTS ===============
export async function getProfile() {
  return authFetch('/api/v1/settings/profile');
}

export async function updateProfile(profileData) {
  return authFetch('/api/v1/settings/profile', {
    method: 'PUT',
    body: JSON.stringify(profileData),
  });
}

export async function uploadProfilePicture(file) {
  const formData = new FormData();
  formData.append('file', file);
  return authFetchFormData('/api/v1/settings/profile/picture', formData);
}

export async function changePassword(passwordData) {
  return authFetch('/api/v1/settings/password', {
    method: 'POST',
    body: JSON.stringify(passwordData),
  });
}

export async function setup2FA(twoFAData) {
  return authFetch('/api/v1/settings/2fa/setup', {
    method: 'POST',
    body: JSON.stringify(twoFAData),
  });
}

export async function verify2FA(tokenData) {
  return authFetch('/api/v1/settings/2fa/verify', {
    method: 'POST',
    body: JSON.stringify(tokenData),
  });
}

export async function getApplicationSettings() {
  return authFetch('/api/v1/settings/application');
}

export async function updateApplicationSettings(settings) {
  return authFetch('/api/v1/settings/application', {
    method: 'PUT',
    body: JSON.stringify(settings),
  });
}

export async function getCaseManagementSettings() {
  return authFetch('/api/v1/settings/case-management');
}

export async function updateCaseManagementSettings(settings) {
  return authFetch('/api/v1/settings/case-management', {
    method: 'PUT',
    body: JSON.stringify(settings),
  });
}

export async function getAllSettings() {
  return authFetch('/api/v1/settings/all');
}

export async function getNotificationPreferences() {
  return authFetch('/api/v1/settings/notifications');
}

export async function updateNotificationPreferences(preferences) {
  return authFetch('/api/v1/settings/notifications', {
    method: 'PUT',
    body: JSON.stringify(preferences),
  });
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
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    dispatchAuthChange();
  }
  
  return res;
}

export async function signup(userData) {
  // userData is now a FormData instance (built in Signup.jsx so the
  // certification file can be attached). FormData must be passed to
  // fetch as-is, with NO Content-Type header — the browser sets the
  // correct multipart/form-data boundary automatically. Setting
  // Content-Type manually, or calling JSON.stringify on a FormData
  // instance, silently sends an empty/garbage body and the backend's
  // Form(...)/File(...) parser will 422 on every required field.
  if (userData instanceof FormData) {
    return fetch(`${BASE}/api/v1/auth/signup`, {
      method: 'POST',
      body: userData,
    });
  }

  // Fallback for any other caller still passing a plain object
  return fetch(`${BASE}/api/v1/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(userData),
  });
}

// =============== CONTACT FORM ENDPOINTS ===============
export async function submitContactRequest(formData) {
  return fetch(`${BASE}/api/v1/contact/submit`, {
    method: 'POST',
    body: formData,
  });
}

export async function checkRequestStatus(requestId, email) {
  return fetch(`${BASE}/api/v1/contact/status/${requestId}?email=${encodeURIComponent(email)}`);
}

// =============== ADMIN ENDPOINTS ===============
export async function getAdminDashboardStats() {
  return authFetch('/api/v1/admin/dashboard/stats');
}

export async function getContactRequests(params = {}) {
  const qs = new URLSearchParams(params).toString();
  return authFetch(`/api/v1/admin/contact-requests${qs ? '?' + qs : ''}`);
}

export async function getContactRequest(requestId) {
  return authFetch(`/api/v1/admin/contact-requests/${requestId}`);
}

export async function updateContactRequest(requestId, updateData) {
  return authFetch(`/api/v1/admin/contact-requests/${requestId}`, {
    method: 'PUT',
    body: JSON.stringify(updateData),
  });
}

export async function convertContactRequestToCase(requestId, conversionData) {
  return authFetch(`/api/v1/admin/contact-requests/${requestId}/convert-to-case`, {
    method: 'POST',
    body: JSON.stringify(conversionData),
  });
}

export async function deleteContactRequest(requestId) {
  return authFetch(`/api/v1/admin/contact-requests/${requestId}`, { method: 'DELETE' });
}

export async function getPendingInvestigators() {
  return authFetch('/api/v1/admin/pending-investigators');
}

export async function updateInvestigatorApproval(investigatorId, approvalData) {
  return authFetch(`/api/v1/admin/investigators/${investigatorId}/approval`, {
    method: 'PUT',
    body: JSON.stringify(approvalData),
  });
}

export async function getInvestigatorApprovalHistory(investigatorId) {
  return authFetch(`/api/v1/admin/investigators/${investigatorId}/approval-history`);
}

export const getInvestigators = async () => {
  return authFetch('/api/v1/admin/investigators');
};

export const getInvestigatorDetails = async (investigatorId) => {
  return authFetch(`/api/v1/admin/investigators/${investigatorId}`);
};

export const updateInvestigator = async (investigatorId, data) => {
  return authFetch(`/api/v1/admin/investigators/${investigatorId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
};

export const updateInvestigatorAvailability = async (isAvailable) => {
  const token = getToken();
  return fetch(`${BASE}/api/v1/investigator/availability`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ is_available: isAvailable }),
  });
};

export async function getAllUsers(params = {}) {
  const qs = new URLSearchParams(params).toString();
  return authFetch(`/api/v1/admin/users${qs ? '?' + qs : ''}`);
}

export async function updateUserRole(userId, role) {
  return authFetch(`/api/v1/admin/users/${userId}/role?role=${encodeURIComponent(role)}`, {
    method: 'PUT',
  });
}

export async function getAdminCases(params = {}) {
  const qs = new URLSearchParams(params).toString();
  return authFetch(`/api/v1/admin/cases${qs ? '?' + qs : ''}`);
}

// =============== UTILITY FUNCTIONS ===============
export function isAuthenticated() {
  return !!getToken();
}

export const getCurrentUser = () => {
  const userStr = localStorage.getItem('user');
  return userStr ? JSON.parse(userStr) : null;
};

export function isAdmin() {
  const user = getCurrentUser();
  return user && user.role === 'admin';
}

export function isInvestigator() {
  const user = getCurrentUser();
  return user && user.role === 'investigator';
}

export function logout() {
  isLoggingOut = true;
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  dispatchAuthChange();
  window.location.href = '/login';
  setTimeout(() => { isLoggingOut = false; }, 1000);
}

export function updateStoredUser(userData) {
  const currentUser = getCurrentUser();
  if (currentUser) {
    const updatedUser = { ...currentUser, ...userData };
    localStorage.setItem('user', JSON.stringify(updatedUser));
    dispatchAuthChange();
  }
}

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

export async function apiCall(url, options = {}) {
  try {
    const response = await authFetch(url, options);
    return await handleApiResponse(response);
  } catch (error) {
    console.error('API call failed:', error);
    throw error;
  }
}