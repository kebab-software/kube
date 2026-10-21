// App.jsx
import React, { useState, useEffect } from 'react';
import './App.css';

const App = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="app">
      <nav className={`nav ${scrollY > 50 ? 'scrolled' : ''}`}>
        <div className="nav-content">
          <div className="logo">
            <span className="logo-icon">▶</span>
            <span className="logo-text">kube</span>
          </div>
          
          <button 
            className={`menu-toggle ${isMenuOpen ? 'open' : ''}`}
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            <span></span>
            <span></span>
          </button>

          <div className={`nav-links ${isMenuOpen ? 'open' : ''}`}>
            <a href="#features">Features</a>
            <a href="#about">About</a>
            <a href="#download">Download</a>
            <a href="https://github.com" className="github-link">
              GitHub
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
              </svg>
            </a>
          </div>
        </div>
      </nav>

      <section className="hero">
        <div className="hero-content">
          <div className="hero-label">
            <span className="dot"></span>
            Open Source • Privacy-First
          </div>
          <h1 className="hero-title">
            Your music,
            <br />
            <span className="gradient-text">without the noise.</span>
          </h1>
          <p className="hero-description">
            A lightweight, open-source YouTube Music client powered by the privacy-focused Invidious API. 
            Enjoy your favourite music without heavy trackers, advertisements, or resource-heavy official apps.
          </p>
          <div className="hero-actions">
            <a href="#download" className="btn btn-primary">
              Download Now
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </a>
            <a href="#features" className="btn btn-secondary">
              Learn More
            </a>
          </div>
        </div>
        
        <div className="hero-visual">
          <div className="player-mockup">
            <div className="player-header">
              <div className="player-dots">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
            <div className="player-content">
              <div className="album-art">
                <div className="album-glow"></div>
                <div className="album-inner">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M9 18V5l12-2v13"/>
                    <circle cx="6" cy="18" r="3"/>
                    <circle cx="18" cy="16" r="3"/>
                  </svg>
                </div>
              </div>
              <div className="track-info">
                <div className="track-title">Midnight City</div>
                <div className="track-artist">M83</div>
              </div>
              <div className="progress-bar">
                <div className="progress-fill"></div>
              </div>
              <div className="player-controls">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/>
                </svg>
                <div className="play-btn">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5v14l11-7z"/>
                  </svg>
                </div>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/>
                </svg>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="features" id="features">
        <div className="section-header">
          <span className="section-label">Features</span>
          <h2>Built different.</h2>
        </div>
        
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
              </svg>
            </div>
            <h3>Lightning Fast</h3>
            <p>Built with performance in mind. No bloat, no lag. Just pure, responsive music streaming.</p>
          </div>
          
          <div className="feature-card">
            <div className="feature-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                <path d="M9 12l2 2 4-4"/>
              </svg>
            </div>
            <h3>Privacy First</h3>
            <p>Zero trackers. No data collection. Your listening habits stay yours and yours alone.</p>
          </div>
          
          <div className="feature-card">
            <div className="feature-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
            </div>
            <h3>No Account Needed</h3>
            <p>Skip the sign-up. Just open and play. Your music library works without any login.</p>
          </div>
          
          <div className="feature-card">
            <div className="feature-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="12" cy="12" r="10"/>
                <path d="M12 6v6l4 2"/>
              </svg>
            </div>
            <h3>Ad-Free Experience</h3>
            <p>No interruptions. No pre-roll ads. Just uninterrupted music flow from start to finish.</p>
          </div>
          
          <div className="feature-card">
            <div className="feature-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
            </div>
            <h3>Open Source</h3>
            <p>Fully transparent codebase. Inspect it, contribute to it, or fork it. Community-driven.</p>
          </div>
          
          <div className="feature-card">
            <div className="feature-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
                <line x1="8" y1="21" x2="16" y2="21"/>
                <line x1="12" y1="17" x2="12" y2="21"/>
              </svg>
            </div>
            <h3>Cross Platform</h3>
            <p>Available everywhere. Desktop, mobile, tablet. Same experience across all devices.</p>
          </div>
        </div>
      </section>

      <section className="stats">
        <div className="stats-grid">
          <div className="stat">
            <div className="stat-value">100%</div>
            <div className="stat-label">Free Forever</div>
          </div>
          <div className="stat">
            <div className="stat-value">0</div>
            <div className="stat-label">Trackers</div>
          </div>
          <div className="stat">
            <div className="stat-value">&lt;10MB</div>
            <div className="stat-label">App Size</div>
          </div>
          <div className="stat">
            <div className="stat-value">MIT</div>
            <div className="stat-label">License</div>
          </div>
        </div>
      </section>

      <section className="about" id="about">
        <div className="about-content">
          <span className="section-label">About</span>
          <h2>Music should be simple.</h2>
          <p>
            Kube was born from frustration. Official music apps have become bloated, 
            privacy-invasive, and resource-heavy. We believe you shouldn't have to 
            sacrifice your privacy or device performance just to listen to music.
          </p>
          <p>
            Powered by Invidious, an open-source alternative frontend to YouTube, 
            Kube gives you access to millions of tracks while keeping your data 
            completely private. No accounts, no tracking, no compromises.
          </p>
          <div className="about-quote">
            "The best interface is the one you don't notice."
          </div>
        </div>
      </section>

      <section className="cta" id="download">
        <div className="cta-content">
          <h2>Ready to listen?</h2>
          <p>Download Kube and experience music the way it should be.</p>
          <div className="cta-actions">
            <a href="#" className="btn btn-primary btn-large">
              Download for Desktop
            </a>
            <a href="#" className="btn btn-secondary btn-large">
              View on GitHub
            </a>
          </div>
          <div className="platforms">
            <span>Available for</span>
            <div className="platform-icons">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
              </svg>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M0 0h11.377v11.372H0zm12.623 0H24v11.372H12.623zM0 12.623h11.377V24H0zm12.623 0H24V24H12.623z"/>
              </svg>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/>
              </svg>
            </div>
          </div>
        </div>
      </section>

      <footer className="footer">
        <div className="footer-content">
          <div className="footer-brand">
            <div className="logo">
              <span className="logo-icon">▶</span>
              <span className="logo-text">kube</span>
            </div>
            <p>Open-source music streaming. No compromises.</p>
          </div>
          <div className="footer-links">
            <div className="footer-column">
              <h4>Product</h4>
              <a href="#features">Features</a>
              <a href="#download">Download</a>
              <a href="#">Changelog</a>
            </div>
            <div className="footer-column">
              <h4>Community</h4>
              <a href="#">GitHub</a>
              <a href="#">Discord</a>
              <a href="#">Contributing</a>
            </div>
            <div className="footer-column">
              <h4>Legal</h4>
              <a href="#">Privacy</a>
              <a href="#">License</a>
              <a href="#">Terms</a>
            </div>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© 2024 Kube. Open source under MIT License.</span>
          <span>Made with ♥ by the community</span>
        </div>
      </footer>
    </div>
  );
};

export default App;
