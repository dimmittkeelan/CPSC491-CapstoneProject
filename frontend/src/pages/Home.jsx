import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useBuild } from "../context/BuildContext";
import { fetchRecommendation } from "../services/buildApi";
import "./Home.css";

export default function Home() {
  const [budgetInput, setBudgetInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const { setBudget, loadBuild } = useBuild();
  const navigate = useNavigate();

  async function handleGenerate(e) {
    e.preventDefault();
    const budget = Number(budgetInput);

    if (!budget || budget < 300) {
      setError("Please enter a budget of at least $300.");
      return;
    }

    setError("");
    setIsLoading(true);

    try {
      const result = await fetchRecommendation(budget);
      setBudget(budget);
      loadBuild(result.parts);
      navigate("/picker");
    } catch (err) {
      setError("Could not generate a build. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="home-wrapper">

      {/* SECTION 1: HERO */}
      <div className="hero-section">
        <div className="hero-content">
          <h1 className="hero-title">BUILD YOUR PERFECT PC</h1>
          <p className="hero-subtitle">
            Generate optimized PC builds tailored to your budget and performance goals.
          </p>

          {/* BUDGET FORM */}
          <form className="budget-form" onSubmit={handleGenerate}>
            <div className="budget-input-row">
              <span className="budget-dollar">$</span>
              <input
                className="budget-input"
                type="number"
                min="300"
                max="10000"
                step="50"
                placeholder="Enter your budget"
                value={budgetInput}
                onChange={(e) => setBudgetInput(e.target.value)}
              />
            </div>
            {error && <p className="budget-error">{error}</p>}
            <div className="cta-group">
              <button
                type="submit"
                className="btn-primary"
                disabled={isLoading}
              >
                {isLoading ? "Generating..." : "Generate Build"}
              </button>
              <Link to="/picker" className="btn-secondary">
                Build Manually
              </Link>
            </div>
          </form>

        </div>
      </div>

      {/* SECTION 2: HOW IT WORKS */}
      <div className="how-it-works-section">
        <h2 className="section-title">How It Works</h2>
        <p className="section-subtitle">Follow three simple steps to get your custom PC build.</p>

        <div className="steps-grid">
          <div className="step-card">
            <div className="step-circle">1</div>
            <h3>Enter Your Budget</h3>
            <p>Type in your maximum spend to get started.</p>
          </div>
          <div className="step-card">
            <div className="step-circle">2</div>
            <h3>Generate a Build</h3>
            <p>Instant recommendations with full compatibility checks.</p>
          </div>
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