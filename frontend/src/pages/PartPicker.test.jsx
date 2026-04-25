import { render, screen, fireEvent } from "@testing-library/react";
import { describe, test, expect, vi, beforeEach } from "vitest";
import { BuildProvider } from "../context/BuildContext";
import PartPicker from "./PartPicker";

vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock("../services/buildApi", () => ({
  fetchParts: vi.fn(),
}));

import { fetchParts } from "../services/buildApi";

const mockParts = {
  cpu: [
    { id: "cpu-1", name: "AMD Ryzen 5 5600X", price: 199, tdp: 65,  socket: "AM4" },
    { id: "cpu-2", name: "AMD Ryzen 7 5800X", price: 299, tdp: 105, socket: "AM4" },
  ],
  gpu: [
    { id: "gpu-1", name: "NVIDIA RTX 3060",    price: 329, tdp: 170 },
    { id: "gpu-2", name: "NVIDIA RTX 3060 Ti", price: 399, tdp: 200 },
  ],
  ram: [
    { id: "ram-1", name: "Corsair 16GB DDR4", price: 45, type: "DDR4" },
  ],
  mobo: [
    { id: "mobo-1", name: "MSI B550-A Pro", price: 129, socket: "AM4", ramType: "DDR4" },
  ],
  psu: [
    { id: "psu-1", name: "EVGA 500W Bronze", price: 49, wattage: 500 },
  ],
};

const wrapper = ({ children }) => <BuildProvider>{children}</BuildProvider>;
const renderPicker = () => render(<PartPicker />, { wrapper });

describe("PartPicker", () => {
  beforeEach(() => {
    fetchParts.mockResolvedValue(mockParts);
  });

  // TC-PP-01: Renders without crashing
  test("TC-PP-01: renders the part picker page", async () => {
    renderPicker();
    expect(await screen.findByText("Part Picker")).toBeInTheDocument();
  });

  // TC-PP-02: CPU tab is active by default
  test("TC-PP-02: CPU tab is shown by default", async () => {
    renderPicker();
    expect(await screen.findByText("AMD Ryzen 5 5600X")).toBeInTheDocument();
  });

  // TC-PP-03: Clicking a tab switches the grid
  test("TC-PP-03: clicking GPU tab shows GPU parts", async () => {
    renderPicker();
    await screen.findByText("AMD Ryzen 5 5600X");
    fireEvent.click(screen.getByText("GPU"));
    expect(await screen.findByText("NVIDIA RTX 3060")).toBeInTheDocument();
  });

  // TC-PP-04: Selecting a part shows the Selected badge
  test("TC-PP-04: clicking a part card selects it", async () => {
    renderPicker();
    fireEvent.click(await screen.findByText("AMD Ryzen 5 5600X"));
    expect(screen.getByText("Selected")).toBeInTheDocument();
  });

  // TC-PP-05: Clicking the same card again deselects it
  test("TC-PP-05: clicking a selected card deselects it", async () => {
    renderPicker();
    const part = await screen.findByText("AMD Ryzen 5 5600X");
    fireEvent.click(part);
    fireEvent.click(part);
    expect(screen.queryByText("Selected")).toBeNull();
  });

  // TC-PP-06: Clear button resets selections
  test("TC-PP-06: clear button removes all selections", async () => {
    renderPicker();
    fireEvent.click(await screen.findByText("AMD Ryzen 5 5600X"));
    expect(screen.getByText("Selected")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Clear"));
    expect(screen.queryByText("Selected")).toBeNull();
  });
});