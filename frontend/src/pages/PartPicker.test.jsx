import { render, screen, fireEvent } from "@testing-library/react";
import { describe, test, expect, vi } from "vitest";
import { BuildProvider } from "../context/BuildContext";
import PartPicker from "./PartPicker";

vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
}));

const wrapper = ({ children }) => <BuildProvider>{children}</BuildProvider>;

const renderPicker = () =>
  render(<PartPicker />, { wrapper });

// TC-PP-01: Renders without crashing
test("TC-PP-01: renders the part picker page", () => {
  renderPicker();
  expect(screen.getByText("Part Picker")).toBeDefined();
});

// TC-PP-02: CPU tab is active by default
test("TC-PP-02: CPU tab is shown by default", () => {
  renderPicker();
  expect(screen.getByText("AMD Ryzen 5 5600X")).toBeDefined();
});

// TC-PP-03: Clicking a tab switches the grid
test("TC-PP-03: clicking GPU tab shows GPU parts", () => {
  renderPicker();
  fireEvent.click(screen.getByText("GPU"));
  expect(screen.getByText("NVIDIA RTX 3060")).toBeDefined();
});

// TC-PP-04: Selecting a part shows the Selected badge
test("TC-PP-04: clicking a part card selects it", () => {
  renderPicker();
  fireEvent.click(screen.getByText("AMD Ryzen 5 5600X"));
  expect(screen.getByText("Selected")).toBeDefined();
});

// TC-PP-05: Clicking the same card again deselects it
test("TC-PP-05: clicking a selected card deselects it", () => {
  renderPicker();
  fireEvent.click(screen.getByText("AMD Ryzen 5 5600X"));
  fireEvent.click(screen.getByText("AMD Ryzen 5 5600X"));
  expect(screen.queryByText("Selected")).toBeNull();
});

// TC-PP-06: Clear button resets selections
test("TC-PP-06: clear button removes all selections", () => {
  renderPicker();
  fireEvent.click(screen.getByText("AMD Ryzen 5 5600X"));
  expect(screen.getByText("Selected")).toBeDefined();
  fireEvent.click(screen.getByText("Clear"));
  expect(screen.queryByText("Selected")).toBeNull();
});