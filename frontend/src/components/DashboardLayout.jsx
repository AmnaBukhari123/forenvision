// components/DashboardLayout.jsx
import React from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { Home, Briefcase, Settings as SettingsIcon, LogOut } from "lucide-react";
import { logout } from "../services/api";
import "./DashboardLayout.css";

export default function DashboardLayout() {
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="dashboard-wrapper">
      {/* Navigation Bar */}
      <nav className="navbar">
        <div className="navbar-brand">
          <h1>ForenVision</h1>
        </div>

        <div className="navbar-links">
          <NavLink
            to="/dashboard/home"
            className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}
          >
            <Home size={20} />
            <span>Home</span>
          </NavLink>

          <NavLink
            to="/dashboard/cases"
            className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}
          >
            <Briefcase size={20} />
            <span>Cases</span>
          </NavLink>

          <NavLink
            to="/dashboard/settings"
            className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}
          >
            <SettingsIcon size={20} />
            <span>Settings</span>
          </NavLink>
        </div>

        <button onClick={handleLogout} className="logout-btn">
          <LogOut size={20} />
          <span>Logout</span>
        </button>
      </nav>

      {/* Main Content Area - renders child routes */}
      <main className="dashboard-main">
        <Outlet />
      </main>
    </div>
  );
}