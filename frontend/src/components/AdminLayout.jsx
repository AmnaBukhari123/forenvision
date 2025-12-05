// components/AdminLayout.jsx
import React from "react";
import { NavLink, useNavigate, Outlet } from "react-router-dom";
import { 
  Shield, 
  Mail, 
  UserCheck, 
  FolderOpen, 
  LogOut 
} from "lucide-react";
import "./AdminLayout.css";

export default function AdminLayout() {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.dispatchEvent(new Event("authChange"));
    navigate("/login");
  };

  return (
    <div className="admin-layout">
      {/* Fixed Navigation Bar */}
      <nav className="admin-navbar">
        <div className="navbar-brand">
          <h1>ForenVision</h1>
        </div>

        <div className="navbar-links">
          <NavLink
            to="/dashboard/admin"
            end
            className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}
          >
            <Shield size={20} />
            <span>Dashboard</span>
          </NavLink>

          <NavLink
            to="/dashboard/admin/contact-requests"
            className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}
          >
            <Mail size={20} />
            <span>Contact Requests</span>
          </NavLink>

          <NavLink
            to="/dashboard/admin/investigators"
            className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}
          >
            <UserCheck size={20} />
            <span>Investigators</span>
          </NavLink>

          <NavLink
            to="/dashboard/admin/cases"
            className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}
          >
            <FolderOpen size={20} />
            <span>All Cases</span>
          </NavLink>
        </div>

        <button onClick={handleLogout} className="logout-btn">
          <LogOut size={20} />
          <span>Logout</span>
        </button>
      </nav>

      {/* Main Content Area */}
      <main className="admin-main-content">
        <Outlet />
      </main>
    </div>
  );
}