import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import {
  Shield, Search, Database, Zap, CheckCircle, ArrowRight,
  Lock, FileText, Users, AlertTriangle, BookOpen,
  ChevronDown, ChevronUp, Fingerprint, Camera,
  Scale, UserCheck, Clock, Globe, Award, TrendingUp
} from "lucide-react";
import "./Landing.css";

function Counter({ target, suffix = "" }) {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  const started = useRef(false);
  useEffect(() => {
    const observer = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !started.current) {
        started.current = true;
        let start = 0;
        const step = Math.ceil(target / 60);
        const timer = setInterval(() => {
          start += step;
          if (start >= target) { setCount(target); clearInterval(timer); }
          else setCount(start);
        }, 18);
      }
    }, { threshold: 0.5 });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [target]);
  return <span ref={ref}>{count}{suffix}</span>;
}

function SpotlightCard({ children, className = "" }) {
  const cardRef = useRef(null);
  const handleMouseMove = (e) => {
    const card = cardRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    card.style.setProperty("--mx", `${e.clientX - rect.left}px`);
    card.style.setProperty("--my", `${e.clientY - rect.top}px`);
  };
  return (
    <div ref={cardRef} className={`spotlight-card ${className}`} onMouseMove={handleMouseMove}>
      {children}
    </div>
  );
}

function Reveal({ children, delay = 0, className = "" }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const observer = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true); }, { threshold: 0.08 });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return (
    <div ref={ref} className={`reveal ${visible ? "reveal-visible" : ""} ${className}`} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

export default function Landing() {
  const [openFaq, setOpenFaq] = useState(null);
  const [mousePos, setMousePos] = useState({ x: -9999, y: -9999 });

  useEffect(() => {
    const move = (e) => setMousePos({ x: e.clientX, y: e.clientY });
    window.addEventListener("mousemove", move);
    return () => window.removeEventListener("mousemove", move);
  }, []);

  const features = [
    { icon: Shield, title: "Secure Evidence Management", description: "Military-grade AES-256 encryption for all forensic data and evidence files with full chain-of-custody logs." },
    { icon: Camera, title: "AI Object Detection", description: "Automated detection and tagging of forensic objects in crime scene images with precise bounding box overlays." },
    { icon: Database, title: "3D Scene Reconstruction", description: "Transform 2D crime scene images into accurate 3D models using TripoSR technology for immersive analysis." },
    { icon: FileText, title: "AI-Generated Reports", description: "Gemini-powered case reports generated in seconds — structured, accurate, and court-ready." },
    { icon: Users, title: "Multi-Role Collaboration", description: "Admin, Investigator, and Client roles each with tailored dashboards and granular access controls." },
    { icon: Clock, title: "Real-time Notifications", description: "Instant email alerts on case updates, assignments, approvals, and witness statement additions." }
  ];

  const crimeTypes = [
    { icon: Fingerprint, title: "Homicide & Violent Crime", description: "Crime scene documentation, evidence cataloguing, and structured case management for homicide investigations." },
    { icon: Search, title: "Cybercrime & Digital Fraud", description: "Case management for digital forensics including fraud, identity theft, and online criminal activity." },
    { icon: Lock, title: "Theft & Burglary", description: "Evidence tracking, witness statements, and suspect profiling for property crime investigations." },
    { icon: AlertTriangle, title: "Drug Trafficking", description: "Secure handling of narcotics case data, informant records, and inter-agency evidence sharing." },
    { icon: Scale, title: "Corporate & White-Collar Crime", description: "Financial fraud documentation, audit trails, and structured reporting for regulatory authorities and compliance" },
    { icon: Globe, title: "Terrorism & National Security", description: "Classified-level case isolation, secure investigator access, and multi-agency collaboration." }
  ];

  const protectionGuidance = [
    { number: "01", title: "Secure Your Digital Footprint", points: ["Use strong, unique passwords and enable two-factor authentication on all accounts.", "Regularly update software and operating systems to patch security vulnerabilities.", "Avoid clicking unknown links or downloading attachments from unverified sources.", "Use a VPN on public Wi-Fi networks to encrypt your internet traffic."] },
    { number: "02", title: "Physical Safety Protocols", points: ["Install CCTV cameras with cloud backup at home and business premises.", "Keep important documents in fireproof, locked storage.", "Never share sensitive personal information with strangers or over the phone.", "Report suspicious activity to local law enforcement immediately."] },
    { number: "03", title: "Evidence Preservation", points: ["Do not disturb a crime scene — photograph everything before moving any object.", "Record timestamps and locations of all evidence as soon as discovered.", "Store digital evidence on write-protected media to maintain integrity.", "Use ForenVision to create a proper chain-of-custody from the moment evidence is logged."] }
  ];

  const crimeActs = [
    { act: "Pakistan Penal Code (PPC) 1860", sections: "Sec 300–338, 378–420", relevance: "Governs violent and property crimes investigated using forensic evidence." },
    { act: "Prevention of Electronic Crimes Act (PECA) 2016", sections: "Sec 3–17", relevance: "Primary legislation for cybercrime and digital forensics investigations." },
    { act: "Anti-Terrorism Act (ATA) 1997", sections: "Sec 6–11A", relevance: "National security cases requiring highest-level secure case management." },
    { act: "Control of Narcotic Substances Act 1997", sections: "Sec 3–21", relevance: "Drug offences requiring secure cross-agency evidence handling." },
    { act: "Companies Act 2017", sections: "Sec 462–492", relevance: "White-collar crime and regulatory authority reporting." }
  ];

  const benefits = [
    { icon: TrendingUp, title: "10x Faster Investigations", desc: "AI-generated reports and automated detection reduce manual work by up to 90%." },
    { icon: Award, title: "Court-Admissible Records", desc: "Full chain-of-custody logs ensure every piece of evidence is legally defensible." },
    { icon: UserCheck, title: "Role-Based Access Control", desc: "Clients, investigators, and admins each see only what they're authorized to view." },
    { icon: Lock, title: "Zero Data Leakage", desc: "End-to-end encrypted storage with audit trails on every access and modification." },
    { icon: Globe, title: "Remote Access", desc: "Access live case data from anywhere — field, courtroom, or command center." },
    { icon: Clock, title: "24/7 Availability", desc: "Cloud infrastructure ensures your case data is always accessible when you need it." }
  ];

  const faqs = [
    { q: "Who can use ForenVision?", a: "ForenVision is designed for law enforcement agencies, forensic investigation firms, private investigators, legal teams, and government authorities. Each user is verified and approved by an Admin before gaining access." },
    { q: "How is my evidence data kept secure?", a: "All data is encrypted at rest and in transit using AES-256 encryption. Access logs are maintained for every file view, modification, or download. Unauthorized access attempts are flagged immediately." },
    { q: "Can clients track their case progress?", a: "Yes. Clients have a dedicated dashboard where they can view case status, uploaded evidence, assigned investigators, and AI-generated reports — all in real time." },
    { q: "Does ForenVision work for digital forensics cases?", a: "Absolutely. ForenVision handles digital evidence files, cybercrime case documentation, and integrates with AI tools to analyze digital artifacts and generate structured investigation reports." },
    { q: "How accurate is the 3D reconstruction?", a: "Using TripoSR technology, 3D models are generated from 2D crime scene images with high spatial accuracy. These are intended as investigative aids and should always be reviewed by a qualified forensic examiner." }
  ];

  return (
    <div className="landing-container">

      <div className="global-spotlight" style={{
        background: `radial-gradient(700px circle at ${mousePos.x}px ${mousePos.y}px, rgba(59,130,246,0.06), transparent 65%)`
      }} />

     {/* Navbar */}
<nav className="landing-navbar">
  <div className="navbar-content">
    <div className="logo-container">
      <div className="logo-ring">
        <Shield className="logo-icon" size={22} />
      </div>
      <h1 className="landing-logo">ForenVision</h1>
    </div>

    <div className="nav-links">
      {["#crimes|Crime Types","#protection|Protection","#acts|Crime Acts","#benefits|Benefits","#about|About","#faq|FAQ"].map(item => {
        const [href, label] = item.split("|");
        return <a key={href} href={href} className="nav-link">{label}</a>;
      })}
    </div>

    <div className="landing-buttons">
      <Link to="/contact" className="btn-nav-ghost">Contact</Link>
      <Link to="/login" className="btn-nav-outline">Login</Link>
      <Link to="/signup" className="btn-nav-solid">Get Started <ArrowRight size={14} /></Link>
    </div>
  </div>
</nav>

      {/* Hero */}
      <section className="landing-hero">
        {[...Array(18)].map((_, i) => (
          <div key={i} className="particle" style={{
            left: `${5 + (i * 5.5) % 90}%`,
            top: `${10 + (i * 7) % 80}%`,
            width: `${2 + (i % 3)}px`,
            height: `${2 + (i % 3)}px`,
            animationDelay: `${(i * 0.4) % 6}s`,
            animationDuration: `${5 + (i % 4)}s`
          }} />
        ))}
        <div className="hero-orb orb-blue" />
        <div className="hero-orb orb-purple" />
        <div className="hero-grid" />

        <div className="hero-content">
          <div className="hero-badge">
            <span className="badge-pulse" />
            <Zap size={13} />
            Pakistan's Next-Generation Forensic Platform
          </div>

          <h1 className="landing-title">
            The Future of<br />
            <span className="hero-gradient-text">Forensic Investigation</span>
          </h1>

          <p className="landing-description">
            ForenVision equips law enforcement, forensic experts, and legal authorities with
            AI-powered tools — from crime scene 3D reconstruction to automated evidence reports —
            all secured under military-grade encryption.
          </p>

          <div className="hero-stats">
            {[
              { num: 75, suffix: "%", label: "Detection Accuracy" },
              { num: 3, suffix: "D", label: "Scene Reconstruction" },
              { num: 90, suffix: "%", label: "Faster Reports" },
              { num: 24, suffix: "/7", label: "System Availability" }
            ].map((s, i) => (
              <React.Fragment key={i}>
                {i > 0 && <div className="stat-sep" />}
                <div className="stat-item">
                  <span className="stat-number"><Counter target={s.num} suffix={s.suffix} /></span>
                  <span className="stat-label">{s.label}</span>
                </div>
              </React.Fragment>
            ))}
          </div>

          <div className="hero-actions">
            <Link to="/signup" className="btn-primary-glow">
              Start Free Trial <ArrowRight size={17} />
            </Link>
            <Link to="/login" className="btn-ghost-outline">Sign In</Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="features-section">
        <div className="ambient-glow glow-blue" />
        <Reveal>
  <div className="section-header">
    <div className="section-text">
      <h2 className="section-title">A Complete Forensic Investigation Suite</h2>
      <p className="section-subtitle">Every tool a modern investigator needs — integrated into one secure platform</p>
    </div>
    <span className="section-badge">What We Offer</span>
  </div>
</Reveal>
        <div className="features-grid">
          {features.map((f, i) => {
            const Icon = f.icon;
            return (
              <Reveal key={i} delay={i * 75}>
                <SpotlightCard className="fv-card">
                  <div className="fv-card-spotlight" />
                  <div className="fv-icon-box fv-icon-blue"><Icon size={22} /></div>
                  <h3>{f.title}</h3>
                  <p>{f.description}</p>
                </SpotlightCard>
              </Reveal>
            );
          })}
        </div>
      </section>

      {/* Crime Types */}
      <section className="crimes-section" id="crimes">
        <div className="ambient-glow glow-red" />
        <Reveal>
  <div className="section-header">
    <div className="section-text">
      <h2 className="section-title">Types of Crimes We Help Investigate</h2>
      <p className="section-subtitle">ForenVision supports investigators across all major crime categories</p>
    </div>
    <span className="section-badge badge-red">Supported Investigations</span>
  </div>
</Reveal>
        <div className="crimes-grid">
          {crimeTypes.map((c, i) => {
            const Icon = c.icon;
            return (
              <Reveal key={i} delay={i * 70}>
                <div className="crime-card">
                  <div className="crime-icon-box"><Icon size={19} /></div>
                  <div>
                    <h3>{c.title}</h3>
                    <p>{c.description}</p>
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>
      </section>

      {/* Protection */}
      <section className="protection-section" id="protection">
        <div className="ambient-glow glow-green" />
        <Reveal>
  <div className="section-header">
    <div className="section-text">
      <h2 className="section-title">How to Protect Yourself & Preserve Evidence</h2>
      <p className="section-subtitle">Critical guidance for citizens, investigators, and authorities</p>
    </div>
    <span className="section-badge badge-green">Safety Guidance</span>
  </div>
</Reveal>
        <div className="protection-grid">
          {protectionGuidance.map((g, i) => (
            <Reveal key={i} delay={i * 90}>
              <div className="protection-card">
                <div className="pcard-accent" />
                <div className="pcard-num">{g.number}</div>
                <h3>{g.title}</h3>
                <ul>
                  {g.points.map((pt, j) => (
                    <li key={j}><CheckCircle size={12} /><span>{pt}</span></li>
                  ))}
                </ul>
              </div>
            </Reveal>
          ))}
        </div>
        <Reveal delay={150}>
          <div className="callout-warning">
            <AlertTriangle size={17} />
            <p><strong>Emergency:</strong> Call <strong>15 (Police)</strong> or <strong>1122 (Rescue)</strong> immediately. ForenVision is an investigation management tool — not an emergency response service.</p>
          </div>
        </Reveal>
      </section>

      {/* Crime Acts */}
      <section className="acts-section" id="acts">
        <div className="ambient-glow glow-purple" />
        <Reveal>
  <div className="section-header">
    <div className="section-text">
      <h2 className="section-title">Relevant Crime Acts & Legislation</h2>
      <p className="section-subtitle">ForenVision aligns with Pakistan's legal framework for forensic investigations</p>
    </div>
    <span className="section-badge badge-purple">Legal Framework</span>
  </div>
</Reveal>
        <Reveal delay={80}>
          <div className="acts-wrap">
            <table className="acts-table">
              <thead><tr><th>Legislation</th><th>Key Sections</th><th>Forensic Relevance</th></tr></thead>
              <tbody>
                {crimeActs.map((a, i) => (
                  <tr key={i} className="act-row" style={{ animationDelay: `${i * 90}ms` }}>
                    <td><BookOpen size={12} /> {a.act}</td>
                    <td className="act-sec">{a.sections}</td>
                    <td className="act-rel">{a.relevance}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Reveal>
        <p className="acts-note">* Always consult a qualified legal professional for advice on specific legislative matters.</p>
      </section>

      {/* Benefits */}
      <section className="benefits-section" id="benefits">
        <div className="ambient-glow glow-blue" />
        <Reveal>
  <div className="section-header">
    <div className="section-text">
      <h2 className="section-title">Benefits for Investigators & Authorities</h2>
      <p className="section-subtitle">Where Pakistan’s investigators get the edge</p>
    </div>
    <span className="section-badge">Why ForenVision</span>
  </div>
</Reveal>
        <div className="benefits-grid">
          {benefits.map((b, i) => {
            const Icon = b.icon;
            return (
              <Reveal key={i} delay={i * 70}>
                <SpotlightCard className="fv-card fv-card-purple">
                  <div className="fv-card-spotlight" />
                  <div className="fv-icon-box fv-icon-purple"><Icon size={20} /></div>
                  <h3>{b.title}</h3>
                  <p>{b.desc}</p>
                </SpotlightCard>
              </Reveal>
            );
          })}
        </div>
      </section>

      {/* FAQ */}
      <section className="faq-section" id="faq">
        <Reveal>
  <div className="section-header">
    <div className="section-text">
      <h2 className="section-title">Frequently Asked Questions</h2>
      <p className="section-subtitle">Everything evaluators and authorities need to know</p>
    </div>
    <span className="section-badge">FAQ</span>
  </div>
</Reveal>
        <div className="faq-list">
          {faqs.map((faq, i) => (
            <Reveal key={i} delay={i * 55}>
              <div className={`faq-item ${openFaq === i ? "faq-open" : ""}`} onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                <div className="faq-q">
                  <span>{faq.q}</span>
                  {openFaq === i ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </div>
                {openFaq === i && <div className="faq-a"><p>{faq.a}</p></div>}
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* About Us */}
<section className="about-section" id="about">
  <div className="ambient-glow glow-purple" />
  <Reveal>
    <div className="section-header">
      <div className="section-text">
        <h2 className="section-title">The Minds Behind ForenVision</h2>
        <p className="section-subtitle">Passionate developers building Pakistan's next-generation forensic platform</p>
      </div>
      <span className="section-badge badge-purple">Meet the Team</span>
    </div>
  </Reveal>

  <div className="about-cards">
    {[
      {
        initials: "MN",
        name: "Maham Naveed",
        role: "Co-Founder & Developer",
        linkedin: "https://linkedin.com/in/maham-naveed",
        email: "mahamnaveed@gmail.com",
        github: "https://github.com/mahamnaveed"
      },
      {
        initials: "AB",
        name: "Amna Bukhari",
        role: "Co-Founder & Developer",
        linkedin: "https://linkedin.com/in/amna-bukhari",
        email: "forenvisionofficial@gmail.com",
        github: "https://github.com/amnabukhari"
      }
    ].map((m, i) => (
      <Reveal key={i} delay={i * 130}>
        <SpotlightCard className="member-card">
          <div className="member-card-top-glow" />
          <div className="member-avatar-ring">
            <span className="member-initials">{m.initials}</span>
          </div>
          <div className="member-info">
          <div className="member-name">{m.name}</div>
          <div className="member-role-badge">{m.role}</div>
          </div>
          <div className="member-divider" />
          <div className="member-links">
            <a href={m.linkedin} target="_blank" rel="noreferrer" className="member-link member-link-li">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
              </svg>
              LinkedIn
              <span className="member-link-arrow">↗</span>
            </a>
            <a href={`mailto:${m.email}`} className="member-link member-link-gm">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 010 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z"/>
              </svg>
              {m.email}
              <span className="member-link-arrow">↗</span>
            </a>
            <a href={m.github} target="_blank" rel="noreferrer" className="member-link member-link-gh">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
              </svg>
              GitHub
              <span className="member-link-arrow">↗</span>
            </a>
          </div>
        </SpotlightCard>
      </Reveal>
    ))}
  </div>
</section>

      {/* CTA */}
      <section className="cta-section">
        <div className="cta-orb cta-orb-1" />
        <div className="cta-orb cta-orb-2" />
        <Reveal>
          <div className="cta-inner">
            <h2>Ready to Transform Your Investigations?</h2>
            <p>Join forensic professionals using ForenVision to solve cases faster and smarter.</p>
            <div className="cta-btns">
              <Link to="/signup" className="btn-primary-glow">Get Started Free <ArrowRight size={17} /></Link>
              <Link to="/contact" className="btn-ghost-outline">Contact Our Team</Link>
            </div>
          </div>
        </Reveal>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="footer-inner">
          <div className="footer-brand"><Shield size={18} /><span>ForenVision</span></div>
          <p>© 2024 ForenVision. All rights reserved. | Empowering Forensic Excellence in Pakistan</p>
          <div className="footer-links">
            {["#crimes|Crime Types","#protection|Protection Guide","#acts|Crime Acts"].map(item => {
              const [href, label] = item.split("|");
              return <a key={href} href={href}>{label}</a>;
            })}
            <Link to="/contact">Contact</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
