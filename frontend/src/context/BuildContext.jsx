import React, { createContext, useContext, useReducer, useMemo} from "react";

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
                selected: {
                    ...state.selected,
                    [action.category]: action.part,
                },
            };

        case "REMOVE_PART":
            return {
                ...state,
                selected: {
                    ...state.selected,
                    [action.category]: null,
                },
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

    // not exact
    if (selected.mobo) {
        totalWattage += 35;
    }

    return { totalPrice, totalWattage};
}

function computeIssues(selected) {
    const issues = [];

    const cpu = selected.cpu;
    const gpu = selected.gpu;
    const ram = selected.ram;
    const mb = selected.mobo;
    const psu = selected.psu;

    if (cpu && mb && cpu.socket !== mb.socket) {
        issues.push(
            `CPU socket (${cpu.socket}) does not match motherboard socket (${mb.socket}).`
        );
    }

    if (ram && mb && ram.type !== mb.ramType) {
        issues.push(
            `RAM type (${ram.type}) does not match motherboard RAM type (${mb.ramType}).`
        );
    }

    const { totalWattage } = computeTotals(selected);

    if (psu) {
        const recommendedWattage = Math.ceil(totalWattage * 1.2);

        if (psu.wattage < recommendedWattage) {
            issues.push(
                `PSU may be too weak. Estimated usage is ${totalWattage}W, recommend at least ${recommendedWattage}W.`
            );
        }
    }

  return issues;
}

export function BuildProvider({ children }) {
    const [state, dispatch] = useReducer(reducer, initialState);

    const derived = useMemo(() => {
        const totals = computeTotals(state.selected);
        const issues = computeIssues(state.selected);

        return {
            ...totals,
            issues,
        };
    }, [state.selected]);

    const value = {
        selected: state.selected,

        totalPrice: derived.totalPrice,
        totalWattage: derived.totalWattage,

        issues: derived.issues,

        selectPart: (category, part) =>
            dispatch({
                type: "SELECT_PART",
                category,
                part,
            }),

        removePart: (category) =>
            dispatch({
                type: "REMOVE_PART",
                category,
            }),

        clearBuild: () =>
            dispatch({
                type: "CLEAR_BUILD",
            }),
            
    };

    return (
    <BuildContext.Provider value={value}>
      {children}
    </BuildContext.Provider>
  );
}

export function useBuild() {
  const context = useContext(BuildContext);

  if (!context) {
    throw new Error("useBuild must be used inside BuildProvider");
  }

  return context;
}

