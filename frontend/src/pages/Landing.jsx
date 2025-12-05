import React from "react";
import { Link } from "react-router-dom";
import { Shield, Search, Database, Zap, CheckCircle, ArrowRight } from "lucide-react";
import "./Landing.css";

export default function Landing() {
  const features = [
    {
      icon: Shield,
      title: "Secure Evidence Management",
      description: "Military-grade encryption for all your forensic data and evidence"
    },
    {
      icon: Search,
      title: "Advanced Analysis Tools",
      description: "AI-powered analysis to uncover critical insights faster"
    },
    {
      icon: Database,
      title: "Centralized Case Database",
      description: "Access all your cases and evidence from a single platform"
    },
    {
      icon: Zap,
      title: "Real-time Collaboration",
      description: "Work seamlessly with your team across multiple investigations"
    }
  ];

  const benefits = [
    "AI-powered 2D to 3D crime scene reconstruction",
    "Comprehensive evidence tracking and chain of custody",
    "Real-time case updates and notifications",
    "Advanced reporting and analytics",
    "Secure cloud storage with encryption",
    "Multi-user collaboration capabilities"
  ];

  return (
    <div className="landing-container">
      {/* Navbar */}
      <nav className="landing-navbar">
        <div className="navbar-content">
          <div className="logo-container">
            <Shield className="logo-icon" size={28} />
            <h1 className="landing-logo">ForenVision</h1>
          </div>
          <div className="landing-buttons">
            <Link to="/contact" className="btn btn-contact">
              Contact Us
            </Link>
            <Link to="/login" className="btn btn-login">
              Login
            </Link>
            <Link to="/signup" className="btn btn-signup">
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="landing-hero">
        <div className="hero-content">
          <div className="hero-badge">
            <Zap size={16} />
            <span>Next-Generation Forensic Platform</span>
          </div>
          
          <h1 className="landing-title">
            Revolutionize Your
            <br />
            <span className="highlight">Forensic Investigations</span>
          </h1>
          
          <p className="landing-description">
            ForenVision combines cutting-edge AI technology with powerful forensic tools
            to streamline crime scene analysis, evidence management, and case reporting.
            Transform the way you investigate.
          </p>

          <div className="hero-actions">
            <Link to="/signup" className="btn btn-get-started">
              Start Free Trial
              <ArrowRight size={20} />
            </Link>
            <Link to="/login" className="btn btn-demo">
              View Demo
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="features-section">
        <div className="section-header">
          <h2 className="section-title">Powerful Features for Modern Forensics</h2>
          <p className="section-subtitle">
            Everything you need to manage forensic investigations efficiently
          </p>
        </div>

        <div className="features-grid">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <div key={index} className="feature-card">
                <div className="feature-icon">
                  <Icon size={28} />
                </div>
                <h3 className="feature-title">{feature.title}</h3>
                <p className="feature-description">{feature.description}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Benefits Section */}
      <section className="benefits-section">
        <div className="benefits-content">
          <div className="benefits-text">
            <h2 className="benefits-title">Why Choose ForenVision?</h2>
            <p className="benefits-subtitle">
              Built by forensic experts for forensic professionals
            </p>
            <div className="benefits-list">
              {benefits.map((benefit, index) => (
                <div key={index} className="benefit-item">
                  <CheckCircle size={20} className="benefit-icon" />
                  <span>{benefit}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="benefits-visual">
            <div className="visual-card">
              <div className="visual-icon">
                <Shield size={64} />
              </div>
              <h3>Trusted by Professionals</h3>
              <p>Join thousands of forensic investigators worldwide</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta-section">
        <div className="cta-content">
          <h2 className="cta-title">Ready to Transform Your Investigations?</h2>
          <p className="cta-description">
            Start your free trial today. No credit card required.
          </p>
          <div className="cta-actions">
            <Link to="/signup" className="btn btn-cta-primary">
              Get Started Free
              <ArrowRight size={20} />
            </Link>
            <Link to="/login" className="btn btn-cta-secondary">
              Sign In
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="footer-content">
          <div className="footer-brand">
            <Shield size={24} />
            <span>ForenVision</span>
          </div>
          <p className="footer-text">
            © 2024 ForenVision. All rights reserved. | Empowering Forensic Excellence
          </p>
        </div>
      </footer>
    </div>
  );
}