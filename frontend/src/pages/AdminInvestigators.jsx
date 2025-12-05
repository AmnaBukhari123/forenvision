//AdminInvestigators.jsx
import React, { useState, useEffect } from "react";
import { 
  UserCheck, 
  Briefcase, 
  Award, 
  Calendar,
  FolderOpen,
  CheckCircle,
  Clock,
  ChevronDown,
  ChevronUp,
  Search,
  Filter,
  Edit,
  Eye
} from "lucide-react";
import { 
  getInvestigators, 
  getInvestigatorDetails,
  updateInvestigator 
} from "../services/api";
import "./AdminInvestigators.css";

export default function AdminInvestigators() {
  const [investigators, setInvestigators] = useState([]);
  const [expandedInvestigator, setExpandedInvestigator] = useState(null);
  const [investigatorCases, setInvestigatorCases] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadingCases, setLoadingCases] = useState({});
  const [showEditModal, setShowEditModal] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [searchQuery, setSearchQuery] = useState("");
  const [filterAvailable, setFilterAvailable] = useState("all");

  const [editData, setEditData] = useState({
    specialization: "",
    years_of_experience: "",
    certification: "",
    department: "",
    is_available: true
  });
  const [editingInvestigator, setEditingInvestigator] = useState(null);

  useEffect(() => {
    loadInvestigators();
  }, []);

  const loadInvestigators = async () => {
    try {
      setLoading(true);
      const response = await getInvestigators();
      const data = await response.json();
      setInvestigators(data.investigators || []);
    } catch (error) {
      console.error("Failed to load investigators:", error);
      setMessage({ type: "error", text: "Failed to load investigators" });
    } finally {
      setLoading(false);
    }
  };

  const toggleInvestigatorCases = async (investigatorId) => {
    if (expandedInvestigator === investigatorId) {
      setExpandedInvestigator(null);
      return;
    }

    setExpandedInvestigator(investigatorId);

    if (!investigatorCases[investigatorId]) {
      try {
        setLoadingCases(prev => ({ ...prev, [investigatorId]: true }));
        const response = await getInvestigatorDetails(investigatorId);
        const data = await response.json();
        setInvestigatorCases(prev => ({
          ...prev,
          [investigatorId]: {
            cases: data.cases || [],
            statistics: data.statistics || {}
          }
        }));
      } catch (error) {
        console.error("Failed to load investigator cases:", error);
        setMessage({ type: "error", text: "Failed to load cases" });
      } finally {
        setLoadingCases(prev => ({ ...prev, [investigatorId]: false }));
      }
    }
  };

  const openEditModal = (investigator) => {
    setEditData({
      specialization: investigator.specialization || "",
      years_of_experience: investigator.years_of_experience || "",
      certification: investigator.certification || "",
      department: investigator.department || "",
      is_available: investigator.is_available !== false
    });
    setEditingInvestigator(investigator);
    setShowEditModal(true);
  };

  const handleUpdate = async (e) => {
    e.preventDefault();

    try {
      const updatePayload = {
        ...editData,
        years_of_experience: editData.years_of_experience ? parseInt(editData.years_of_experience) : null
      };

      const response = await updateInvestigator(editingInvestigator.id, updatePayload);

      if (response.ok) {
        setMessage({ type: "success", text: "Investigator updated successfully" });
        setShowEditModal(false);
        loadInvestigators();
      }
    } catch (error) {
      console.error("Failed to update investigator:", error);
      setMessage({ type: "error", text: "Failed to update investigator" });
    }
  };

  const getWorkloadStatus = (activeCases) => {
    if (activeCases === 0) return { label: "Available", color: "success" };
    if (activeCases <= 3) return { label: "Light Load", color: "info" };
    if (activeCases <= 6) return { label: "Moderate Load", color: "warning" };
    return { label: "Heavy Load", color: "danger" };
  };

  const filteredInvestigators = investigators.filter(inv => {
    const matchesSearch = 
      (inv.name?.toLowerCase() || "").includes(searchQuery.toLowerCase()) ||
      (inv.email?.toLowerCase() || "").includes(searchQuery.toLowerCase()) ||
      (inv.specialization?.toLowerCase() || "").includes(searchQuery.toLowerCase());

    const matchesFilter = 
      filterAvailable === "all" ||
      (filterAvailable === "available" && inv.is_available) ||
      (filterAvailable === "unavailable" && !inv.is_available);

    return matchesSearch && matchesFilter;
  });

  return (
    <div className="admin-investigators">
      {message.text && (
        <div className={`message-banner ${message.type}`}>
          {message.text}
          <button onClick={() => setMessage({ type: "", text: "" })}>×</button>
        </div>
      )}

      {/* Search and Filter Bar */}
      <div className="search-filter-bar">
        <div className="search-box">
          <Search size={20} />
          <input
            type="text"
            placeholder="Search by name, email, or specialization..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="filter-group">
          <Filter size={18} />
          <select value={filterAvailable} onChange={(e) => setFilterAvailable(e.target.value)}>
            <option value="all">All Investigators</option>
            <option value="available">Available</option>
            <option value="unavailable">Unavailable</option>
          </select>
        </div>
      </div>

      {/* Investigators Table */}
      {loading ? (
        <div className="loading-state">Loading investigators...</div>
      ) : filteredInvestigators.length === 0 ? (
        <div className="empty-state">
          <UserCheck size={48} />
          <h3>No Investigators Found</h3>
          <p>No investigators match your search criteria.</p>
        </div>
      ) : (
        <div className="investigators-table-container">
          <table className="investigators-table">
            <thead>
              <tr>
                <th>Investigator</th>
                <th>Specialization</th>
                <th>Department</th>
                <th>Experience</th>
                <th>Availability</th>
                <th>Workload</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredInvestigators.map((investigator) => {
                const workloadStatus = getWorkloadStatus(investigator.active_cases || 0);
                const isExpanded = expandedInvestigator === investigator.id;
                const casesData = investigatorCases[investigator.id];
                
                return (
                  <React.Fragment key={investigator.id}>
                    <tr className="investigator-row">
                      <td>
                        <div className="investigator-info">
                          <div className="investigator-avatar">
                            <UserCheck size={24} />
                          </div>
                          <div>
                            <div className="investigator-name">{investigator.name}</div>
                            <div className="investigator-email">{investigator.email}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        {investigator.specialization ? (
                          <span className="info-badge">
                            <Briefcase size={14} />
                            {investigator.specialization}
                          </span>
                        ) : (
                          <span className="text-muted">N/A</span>
                        )}
                      </td>
                      <td>
                        {investigator.department ? (
                          <span className="info-badge">
                            <Award size={14} />
                            {investigator.department}
                          </span>
                        ) : (
                          <span className="text-muted">N/A</span>
                        )}
                      </td>
                      <td>
                        {investigator.years_of_experience ? (
                          <span className="experience-badge">
                            <Calendar size={14} />
                            <span className="experience-text">{investigator.years_of_experience} years</span>
                          </span>
                        ) : (
                          <span className="text-muted">N/A</span>
                        )}
                      </td>
                      <td>
                        <span className={`availability-badge ${investigator.is_available ? 'available' : 'unavailable'}`}>
                          {investigator.is_available ? "Available" : "Unavailable"}
                        </span>
                      </td>
                      <td>
                        <span className={`workload-badge ${workloadStatus.color}`}>
                          {workloadStatus.label}
                        </span>
                      </td>
                      <td>
                        <div className="action-buttons">
                          <button 
                            className="btn-icon edit"
                            onClick={() => openEditModal(investigator)}
                            title="Edit"
                          >
                            <Edit size={16} />
                          </button>
                          <button 
                            className="btn-icon toggle"
                            onClick={() => toggleInvestigatorCases(investigator.id)}
                            title={isExpanded ? "Hide Cases" : "View Cases"}
                          >
                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* Expanded Cases Section */}
                    {isExpanded && (
                      <tr className="expanded-row">
                        <td colSpan="7">
                          <div className="investigator-cases-expanded">
                            {loadingCases[investigator.id] ? (
                              <div className="loading-cases">Loading cases...</div>
                            ) : casesData && casesData.cases.length > 0 ? (
                              <div className="cases-table">
                                <table>
                                  <thead>
                                    <tr>
                                      <th>Case ID</th>
                                      <th>Case Name</th>
                                      <th>Category</th>
                                      <th>Priority</th>
                                      <th>Status</th>
                                      <th>Created</th>
                                      <th>Last Updated</th>
                                      <th>Actions</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {casesData.cases.map((caseItem) => (
                                      <tr key={caseItem.id}>
                                        <td>#{caseItem.id}</td>
                                        <td className="case-name-cell">{caseItem.name}</td>
                                        <td>
                                          <span className="case-category-badge">
                                            {caseItem.category || "N/A"}
                                          </span>
                                        </td>
                                        <td>
                                          <span className={`priority-badge ${(caseItem.priority || '').toLowerCase()}`}>
                                            {caseItem.priority || "N/A"}
                                          </span>
                                        </td>
                                        <td>
                                          <span className={`status-badge ${(caseItem.status || '').toLowerCase()}`}>
                                            {caseItem.status || "N/A"}
                                          </span>
                                        </td>
                                        <td>{new Date(caseItem.created_at).toLocaleDateString()}</td>
                                        <td>{new Date(caseItem.updated_at).toLocaleDateString()}</td>
                                        <td>
                                          <button className="btn-icon view" title="View Case">
                                            <Eye size={16} />
                                          </button>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            ) : (
                              <div className="no-cases-message">
                                <FolderOpen size={32} />
                                <p>No cases assigned to this investigator yet</p>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && editingInvestigator && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Edit Investigator - {editingInvestigator.name}</h2>
              <button className="modal-close" onClick={() => setShowEditModal(false)}>×</button>
            </div>

            <form onSubmit={handleUpdate} className="modal-body">
              <div className="form-group">
                <label>Specialization</label>
                <input
                  type="text"
                  value={editData.specialization}
                  onChange={(e) => setEditData({...editData, specialization: e.target.value})}
                  className="form-input"
                  placeholder="e.g., Digital Forensics, Cybercrime"
                />
              </div>

              <div className="form-group">
                <label>Years of Experience</label>
                <input
                  type="number"
                  value={editData.years_of_experience}
                  onChange={(e) => setEditData({...editData, years_of_experience: e.target.value})}
                  className="form-input"
                  placeholder="e.g., 5"
                  min="0"
                />
              </div>

              <div className="form-group">
                <label>Certification</label>
                <input
                  type="text"
                  value={editData.certification}
                  onChange={(e) => setEditData({...editData, certification: e.target.value})}
                  className="form-input"
                  placeholder="e.g., CFE, CFCE, EnCE"
                />
              </div>

              <div className="form-group">
                <label>Department</label>
                <input
                  type="text"
                  value={editData.department}
                  onChange={(e) => setEditData({...editData, department: e.target.value})}
                  className="form-input"
                  placeholder="e.g., Cybercrime Unit, Forensics Division"
                />
              </div>

              <div className="form-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={editData.is_available}
                    onChange={(e) => setEditData({...editData, is_available: e.target.checked})}
                  />
                  <span>Available for new cases</span>
                </label>
              </div>

              <div className="modal-actions">
                <button type="submit" className="btn-action save">
                  <CheckCircle size={16} />
                  Save Changes
                </button>
                <button 
                  type="button" 
                  className="btn-action cancel"
                  onClick={() => setShowEditModal(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}