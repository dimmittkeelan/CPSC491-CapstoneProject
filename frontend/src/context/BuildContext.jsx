import React, { createContext, useContext, useReducer, useState, useMemo } from "react";

const BuildContext = createContext(null);

const initialState = {
  selected: {
    cpu: null,
    gpu: null,
    ram: null,
    mobo: null,
    psu: null,
  },
};

function reducer(state, action) {
  switch (action.type) {
    case "SELECT_PART":
      return {
        ...state,
        selected: { ...state.selected, [action.category]: action.part },
      };
    case "REMOVE_PART":
      return {
        ...state,
        selected: { ...state.selected, [action.category]: null },
      };
    case "LOAD_BUILD":
      return {
        ...state,
        selected: { ...initialState.selected, ...action.parts },
      };
    case "CLEAR_BUILD":
      return initialState;
    default:
      return state;
  }
}

function computeTotals(selected) {
  let totalPrice = 0;
  let totalWattage = 0;
  Object.values(selected).forEach((part) => {
    if (!part) return;
    totalPrice += Number(part.price || 0);
    totalWattage += Number(part.tdp || 0);
  });
  if (selected.mobo) totalWattage += 35;
  return { totalPrice, totalWattage };
}

function computeIssues(selected) {
  const issues = [];
  const { cpu, ram, mobo, psu } = selected;

  if (cpu && mobo && cpu.socket !== mobo.socket) {
    issues.push(`CPU socket (${cpu.socket}) does not match motherboard socket (${mobo.socket}).`);
  }
  if (ram && mobo && ram.type !== mobo.ramType) {
    issues.push(`RAM type (${ram.type}) does not match motherboard RAM type (${mobo.ramType}).`);
  }

  const { totalWattage } = computeTotals(selected);
  if (psu) {
    const recommended = Math.ceil(totalWattage * 1.2);
    if (psu.wattage < recommended) {
      issues.push(`PSU may be too weak. Estimated usage is ${totalWattage}W, recommend at least ${recommended}W.`);
    }
  }
  return issues;
}

export function BuildProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [budget, setBudget] = useState(0);

  const derived = useMemo(() => {
    const totals = computeTotals(state.selected);
    const issues = computeIssues(state.selected);
    return { ...totals, issues };
  }, [state.selected]);

  const value = {
    selected: state.selected,
    totalPrice: derived.totalPrice,
    totalWattage: derived.totalWattage,
    issues: derived.issues,
    budget,
    setBudget,

    selectPart: (category, part) => dispatch({ type: "SELECT_PART", category, part }),
    removePart: (category) => dispatch({ type: "REMOVE_PART", category }),
    loadBuild: (parts) => dispatch({ type: "LOAD_BUILD", parts }),
    clearBuild: () => dispatch({ type: "CLEAR_BUILD" }),
  };

  return (
    <BuildContext.Provider value={value}>
      {children}
    </BuildContext.Provider>
  );
}

export function useBuild() {
  const context = useContext(BuildContext);
  if (!context) throw new Error("useBuild must be used inside BuildProvider");
  return context;
}