// App.jsx
import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Contact from "./pages/Contact";
import DashboardLayout from "./components/DashboardLayout";
import DashboardHome from "./pages/DashboardHome";
import Cases from "./pages/Cases";
import CreateCase from "./pages/CreateCase";
import CaseDetail from "./pages/CaseDetail";
import Reconstruction3D from "./pages/Reconstruction3d";
import Settings from "./pages/Settings";
import AdminLayout from "./components/AdminLayout";
import AdminDashboard from "./pages/AdminDashboard";
import AdminContactRequests from "./pages/AdminContactRequests";
import AdminInvestigators from "./pages/AdminInvestigators";
import AdminCases from "./pages/AdminCases";
import PendingInvestigators from "./pages/PendingInvestigators";
import CaseAnalytics from "./pages/CaseAnalytics";

export default function App() {
  const [authState, setAuthState] = useState({
    isLoggedIn: false,
    user: null,
    isLoading: true
  });

  useEffect(() => {
    const syncAuthState = () => {
      const token = localStorage.getItem("token");
      const userStr = localStorage.getItem("user");
      
      if (token && userStr) {
        try {
          const user = JSON.parse(userStr);
          setAuthState({ isLoggedIn: true, user: user, isLoading: false });
        } catch (e) {
          console.error("Failed to parse user data:", e);
          localStorage.removeItem("token");
          localStorage.removeItem("user");
          setAuthState({ isLoggedIn: false, user: null, isLoading: false });
        }
      } else {
        setAuthState({ isLoggedIn: false, user: null, isLoading: false });
      }
    };

    syncAuthState();

    const handleStorageChange = (e) => {
      if (e.key === "token" || e.key === "user" || e.key === null) {
        syncAuthState();
      }
    };

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("authChange", syncAuthState);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("authChange", syncAuthState);
    };
  }, []);

  if (authState.isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontSize: '18px' }}>
        Loading...
      </div>
    );
  }

  const isAdmin = authState.user?.role === "admin";

  const ProtectedRoute = ({ children, allowedRoles = null }) => {
    if (!authState.isLoggedIn) return <Navigate to="/login" replace />;
    if (allowedRoles && !allowedRoles.includes(authState.user?.role)) {
      return <Navigate to={isAdmin ? "/dashboard/admin" : "/dashboard/home"} replace />;
    }
    return children;
  };

  const ProtectedRouteWithApproval = ({ children, allowedRoles = null }) => {
    if (!authState.isLoggedIn) return <Navigate to="/login" replace />;

    if (allowedRoles && !allowedRoles.includes(authState.user?.role)) {
      return <Navigate to={isAdmin ? "/dashboard/admin" : "/dashboard/home"} replace />;
    }

    if (authState.user?.role === "investigator" && authState.user?.is_approved === false) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      return <Navigate to="/login" replace />;
    }

    if (authState.user?.role === "investigator" && authState.user?.is_approved === null) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      return <Navigate to="/login" replace />;
    }

    return children;
  };

  return (
    <Router>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<Landing />} />
        <Route
          path="/login"
          element={authState.isLoggedIn ? <Navigate to={isAdmin ? "/dashboard/admin" : "/dashboard/home"} replace /> : <Login />}
        />
        <Route
          path="/signup"
          element={authState.isLoggedIn ? <Navigate to={isAdmin ? "/dashboard/admin" : "/dashboard/home"} replace /> : <Signup />}
        />
        <Route path="/contact" element={<Contact />} />

        {/* Dashboard redirect */}
        <Route
          path="/dashboard"
          element={authState.isLoggedIn ? <Navigate to={isAdmin ? "/dashboard/admin" : "/dashboard/home"} replace /> : <Navigate to="/login" replace />}
        />

        {/* Investigator routes */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRouteWithApproval allowedRoles={['investigator']}>
              <DashboardLayout />
            </ProtectedRouteWithApproval>
          }
        >
          <Route path="home" element={<DashboardHome />} />
          <Route path="cases" element={<Cases />} />
          <Route path="cases/create" element={<CreateCase />} />
          <Route path="cases/:id" element={<CaseDetail />} />
          <Route path="cases/:id/reconstruct" element={<Reconstruction3D />} />
          <Route path="cases/:id/analytics" element={<CaseAnalytics />} />
          <Route path="settings" element={<Settings />} />
        </Route>

        {/* Admin routes */}
        <Route
          path="/dashboard/admin"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<AdminDashboard />} />
          <Route path="contact-requests" element={<AdminContactRequests />} />
          <Route path="investigators" element={<AdminInvestigators />} />
          <Route path="pending-investigators" element={<PendingInvestigators />} />
          <Route path="cases" element={<AdminCases />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}