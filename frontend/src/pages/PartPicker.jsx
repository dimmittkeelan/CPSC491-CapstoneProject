import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useBuild } from "../context/BuildContext";
import { partsData, CATEGORIES, CATEGORY_LABELS } from "../data/partsData";
import "../styles/PartPicker.css";

export default function PartPicker() {
    const [activeTab, setActiveTab] = useState("cpu");

    const { selected, selectPart, removePart, totalPrice, issues, clearBuild } = useBuild();

    const navigate = useNavigate();

    const currentSelection = selected[activeTab];

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

            <div className="pickerTabs">
                {CATEGORIES.map((cat) => (
                    <button
                        key={cat}
                        className={[
                            "pickerTab",
                            activeTab === cat ? "pickerTab--active" : "", // highlights current tab
                            selected[cat] ? "pickerTab--done" : "", // green tint when a part is picked
                        ].join(" ")}
                        onClick={() => setActiveTab(cat)}
                    >
                        {CATEGORY_LABELS[cat]}
                        {selected[cat] && <span className="pickerTab__check"> ✓</span>}
                    </button>
                ))}
            </div>

            {/* PART CARDS GRID - shows all parts for the active tab */}
            <div className="pickerGrid">
                {partsData[activeTab].map((part) =>{
                    const isSelected = currentSelection?.id === part.id;

                    return (
                        <button
                            key={part.id}
                            className={`pickerCard ${isSelected ? "pickerCard--selected" : ""}`}
                            onClick={() => handleCardClick(part)}
                        >

                        {/* Part image */}
                        <img className="pickerCard__img" src={part.img} alt={part.name} />

                        <div className="pickerCard__body">
                            {/* Part name and price */}
                            <div className="pickerCard__name">{part.name}</div>
                            <div className="pickerCard__price">${part.price}</div>
                            
                            {/* Spec pills - only renders a spec if field exists on this part type. */}
                            <div className="pickerCard__specs">
                                {part.socket && <span>Socket: {part.socket}</span>}
                                {part.tdp && <span>TDP: {part.tdp}</span>}
                                {part.type && <span>Type: {part.type}</span>}
                                {part.ramType && <span>RAM: {part.ramType}</span>}
                                {part.wattage && <span>Wattage: {part.wattage}</span>}
                            </div>
                            
                        </div>
                        {/* Selected badge - only visible on the chosen card */}
                        {isSelected && <div className="pickerCard__badge">Selected</div>}
                    </button>
                    );
                })}
            </div>

            {/* Footer - shows running total + warnings */}
            <div className="pickerFooter">

                {/* Running price toal from Build Context */}
                <div className="pickerFooter__total">
                    Total: <strong>${totalPrice}</strong>
                </div>

                {/* Compatibility warnings from Build Context {socket mismatch, PSU too weak, etc} */}
                {issues.length > 0 && (
                    <div className="pickerFooter__issues">
                        {issues.map((issue, i) =>(
                            <div key={i} className="pickerFooter__issue">{issue}</div>
                        ))}
                    </div>
                )}

                <div className="pickerFooter__actions">
                {/* Clear resets all selected parts back to null */}
                    <button className="pickerBtn pickerBtn--ghost" onClick={clearBuild}>
                        Clear
                    </button>
                    {/* View Build navigates to /build */}
                    <button className="pickerBtn pickerBtn--primary" onClick={() => navigate("/build")}>
                        View Build
                    </button>
                </div>
            </div>
        </div>
    )
}