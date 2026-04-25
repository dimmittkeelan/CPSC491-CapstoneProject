import { render, screen } from "@testing-library/react";
import { describe, test, expect, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { BuildProvider } from "../context/BuildContext";
import Home from "./Home";

vi.mock("../services/buildApi", () => ({
  fetchRecommendation: vi.fn(),
}));

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  };
});

const renderHome = () =>
  render(
    <MemoryRouter>
      <BuildProvider>
        <Home />
      </BuildProvider>
    </MemoryRouter>
  );

describe("Home page", () => {
  test("renders hero title and subtitle", () => {
    renderHome();
    expect(screen.getByText("BUILD YOUR PERFECT PC")).toBeInTheDocument();
    expect(screen.getByText(/Generate optimized PC builds/i)).toBeInTheDocument();
  });

  test("renders How It Works section with all three steps", () => {
    renderHome();
    expect(screen.getByText("How It Works")).toBeInTheDocument();
    expect(screen.getByText("Enter Your Budget")).toBeInTheDocument();
    expect(screen.getByText("Generate a Build")).toBeInTheDocument();
    expect(screen.getByText("Customize & Save")).toBeInTheDocument();
  });

  test("renders Generate Build button and Build Manually link", () => {
    renderHome();
    expect(screen.getByRole("button", { name: /Generate Build/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Build Manually/i })).toHaveAttribute("href", "/picker");
  });

  test("renders budget input field", () => {
    renderHome();
    expect(screen.getByPlaceholderText("Enter your budget")).toBeInTheDocument();
  });
});