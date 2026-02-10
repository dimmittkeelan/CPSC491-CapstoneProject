import { Link } from "react-router-dom";
import "./Home.css";

export default function Home() {
  return (
    <div className="home-wrapper">
      
      {/* SECTION 1: HERO (The top part with the image) */}
      <div className="hero-section">
        <div className="hero-content">
          <h1 className="hero-title">BUILD YOUR PERFECT PC</h1>
          <p className="hero-subtitle">
            Generate optimized PC builds tailored to your budget and performance goals.
          </p>
          
          <div className="cta-group">
            <Link to="/build" className="btn-primary">Start Building</Link>
            <Link to="/saved" className="btn-secondary">View Saved Builds</Link>
          </div>
        </div>
      </div>

      {/* SECTION 2: HOW IT WORKS */}
      <div className="how-it-works-section">
        <h2 className="section-title">How It Works</h2>
        <p className="section-subtitle">Follow three simple steps to get your custom PC build.</p>

        <div className="steps-grid">
          {/* Step 1 */}
          <div className="step-card">
            <div className="step-circle">1</div>
            <h3>Enter Your Budget</h3>
            <p>Type in your maximum spend to get started.</p>
          </div>

          {/* Step 2 */}
          <div className="step-card">
            <div className="step-circle">2</div>
            <h3>Generate a Build</h3>
            <p>Instant recommendations with full compatibility checks.</p>
          </div>

          {/* Step 3 */}
          <div className="step-card">
            <div className="step-circle">3</div>
            <h3>Customize & Save</h3>
            <p>Tweak parts, save your build, and share it with friends.</p>
          </div>
        </div>
      </div>
    </div>
  );
}