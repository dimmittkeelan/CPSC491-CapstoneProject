import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useBuild } from "../context/BuildContext";
import { partsData as localPartsData, CATEGORIES, CATEGORY_LABELS } from "../data/partsData";
import { fetchParts } from "../services/buildApi";
import "../styles/PartPicker.css";

export default function PartPicker() {
  const [activeTab, setActiveTab] = useState("cpu");
  const [partsData, setPartsData] = useState(null);
  const [loadingParts, setLoadingParts] = useState(true);

  const { selected, selectPart, removePart, totalPrice, budget, issues, clearBuild } = useBuild();
  const navigate = useNavigate();
  const currentSelection = selected[activeTab];

  // Check if parts were pre-loaded by the recommendation
  const hasRecommendation = Object.values(selected).some(Boolean);

  useEffect(() => {
    async function loadParts() {
      try {
        const data = await fetchParts();
        setPartsData(data);
      } catch {
        // Fall back to local data if backend is unavailable
        setPartsData(localPartsData);
      } finally {
        setLoadingParts(false);
      }
    }
    loadParts();
  }, []);

  function handleCardClick(part) {
    if (currentSelection?.id === part.id) {
      removePart(activeTab);
    } else {
      selectPart(activeTab, part);
    }
  }

  return (
    <div className="pickerPage">
      <header className="pickerHeader">
        <h1 className="pickerHeader__title">Part Picker</h1>
        <p className="pickerHeader__subtitle">
          Select a part for each category. Compatibility is checked automatically.
        </p>
      </header>

      {/* Recommendation banner */}
      {hasRecommendation && budget > 0 && (
        <div className="pickerBanner">
          Build recommended for <strong>${budget}</strong> budget — swap any part below to customize.
        </div>
      )}

      <div className="pickerTabs">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            className={[
              "pickerTab",
              activeTab === cat ? "pickerTab--active" : "",
              selected[cat] ? "pickerTab--done" : "",
            ].join(" ")}
            onClick={() => setActiveTab(cat)}
          >
            {CATEGORY_LABELS[cat]}
            {selected[cat] && <span className="pickerTab__check"> ✓</span>}
          </button>
        ))}
      </div>

      {loadingParts ? (
        <p className="pickerStatus">Loading parts...</p>
      ) : (
        <div className="pickerGrid">
          {(partsData?.[activeTab] ?? []).map((part) => {
            const isSelected = currentSelection?.id === part.id;
            return (
              <button
                key={part.id}
                className={`pickerCard ${isSelected ? "pickerCard--selected" : ""}`}
                onClick={() => handleCardClick(part)}
              >
                <img className="pickerCard__img" src={part.img} alt={part.name} />
                <div className="pickerCard__body">
                  <div className="pickerCard__name">{part.name}</div>
                  <div className="pickerCard__price">${part.price}</div>
                  <div className="pickerCard__specs">
                    {part.socket  && <span>Socket: {part.socket}</span>}
                    {part.tdp     && <span>TDP: {part.tdp}W</span>}
                    {part.type    && <span>Type: {part.type}</span>}
                    {part.ramType && <span>RAM: {part.ramType}</span>}
                    {part.wattage && <span>Wattage: {part.wattage}W</span>}
                  </div>
                </div>
                {isSelected && <div className="pickerCard__badge">Selected</div>}
              </button>
            );
          })}
        </div>
      )}

      <div className="pickerFooter">
        <div className="pickerFooter__total">
          Total: <strong>${totalPrice}</strong>
          {budget > 0 && <span className="pickerFooter__budget"> / Budget: ${budget}</span>}
        </div>
        {issues.length > 0 && (
          <div className="pickerFooter__issues">
            {issues.map((issue, i) => (
              <div key={i} className="pickerFooter__issue">{issue}</div>
            ))}
          </div>
        )}
        <div className="pickerFooter__actions">
          <button className="pickerBtn pickerBtn--ghost" onClick={clearBuild}>
            Clear
          </button>
          <button className="pickerBtn pickerBtn--primary" onClick={() => navigate("/build")}>
            View Build
          </button>
        </div>
      </div>
    </div>
  );
}