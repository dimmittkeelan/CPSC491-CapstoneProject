import { render, screen } from "@testing-library/react";
import { describe, test, expect } from "vitest";
import { MemoryRouter } from "react-router-dom";
import Home from "./Home";

describe("Home dashboard", () => {
  test("renders hero and walkthrough sections", () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    );

    expect(screen.getByText("BUILD YOUR PERFECT PC")).toBeInTheDocument();
    expect(screen.getByText("How It Works")).toBeInTheDocument();
    expect(screen.getByText("Enter Your Budget")).toBeInTheDocument();
    expect(screen.getByText("Generate a Build")).toBeInTheDocument();
    expect(screen.getByText("Customize & Save")).toBeInTheDocument();
  });

  test("includes dashboard call-to-action links", () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    );

    expect(screen.getByRole("link", { name: "Start Building" })).toHaveAttribute("href", "/picker");
    expect(screen.getByRole("link", { name: "View Saved Builds" })).toHaveAttribute("href", "/saved");
  });
});
