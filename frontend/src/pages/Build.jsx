import React, { useState } from "react";
import { Link } from "react-router-dom";
import "../styles/build.css";
import { useBuild } from "../context/BuildContext";
import { getCurrentUser } from "../services/authApi";
import { createSavedBuild } from "../services/buildApi";
import pcImage from "../assets/pc-image.png";

function PartCard({ part }) {
  return (
    <div className={`partCard partCard--${part.pos}`}>
      <div className="partCard__imgWrap">
        <img className="partCard__img" src={part.img} alt={part.name} />
      </div>
      <div className="partCard__text">
        <div className="partCard__titleRow">
          <div className="partCard__title">{part.name}</div>
          <div className="partCard__price">${part.price}</div>
        </div>
        <div className="partCard__alt">Alternative: {part.alt}</div>
      </div>
    </div>
  );
}

export default function Build() {
  const { selected, totalPrice, budget, issues } = useBuild();
  const POS = { cpu: "top", gpu: "left", ram: "right", mobo: "bottomLeft", psu: "bottomRight" };
  const parts = Object.fromEntries(
    Object.entries(POS).map(([cat, pos]) => [cat, selected[cat] ? { ...selected[cat], pos } : null])
  );
  const compatible = issues.length === 0;
  const [saveMessage, setSaveMessage] = useState("");
  const [saveError, setSaveError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleSaveBuild = async () => {
    setSaveMessage("");
    setSaveError("");
    setIsSaving(true);

    try {
      const user = await getCurrentUser();

      if (!user) {
        setSaveError("Please sign in first to save builds to your dashboard.");
        return;
      }

      const buildPayload = {
        title: `${parts.cpu?.name ?? "Custom"} + ${parts.gpu?.name ?? "Build"}`,
        totalPrice,
        budget,
        compatible,
        parts,
      };

      try {
        await createSavedBuild(buildPayload);
        setSaveMessage("Build saved. You can view it in Saved Builds.");
      } catch (error) {
        setSaveError(error.message || "Unable to save build right now.");
      }
    } catch (error) {
      setSaveError(error.message || "Unable to save build right now.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="buildPage">
      <header className="buildHeader">
        <h1 className="buildHeader__title">Build Successfully Created</h1>
        <p className="buildHeader__subtitle">
          Here's your optimized setup based on your budget. Click any part to explore or purchase.
        </p>

        <div className="budgetPill">
          <div className="budgetPill__text">
            Total Price: <span>${totalPrice}</span>
            {budget > 0 && <> / Budget: <span>${budget}</span></>}
          </div>
          {compatible && <div className="budgetPill__badge">✓ Compatible</div>}
        </div>

        <div className="buildActions">
          <button className="buildSaveButton" type="button" onClick={handleSaveBuild} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save This Build"}
          </button>
          <Link className="buildSavedLink" to="/saved">
            Go to Saved Builds
          </Link>
        </div>

        {saveMessage ? <p className="buildMessage buildMessage--success">{saveMessage}</p> : null}
        {saveError ? <p className="buildMessage buildMessage--error">{saveError}</p> : null}
      </header>

      <main className="buildCanvas">
        <div className="centerRig">
          <div className="rigGlow" />
          <img
            className="rigImage"
            src={pcImage}
            alt="PC Case"
            onError={(e) => { e.target.style.display = "none"; }}
          />
        </div>

        {parts.cpu  && <PartCard part={parts.cpu} />}
        {parts.gpu  && <PartCard part={parts.gpu} />}
        {parts.ram  && <PartCard part={parts.ram} />}
        {parts.mobo && <PartCard part={parts.mobo} />}
        {parts.psu  && <PartCard part={parts.psu} />}
      </main>
    </div>
  );
}