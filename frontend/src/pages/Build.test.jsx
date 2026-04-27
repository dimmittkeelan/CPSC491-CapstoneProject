import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, test, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import Build from "./Build";

const buildState = {
  selected: {
    cpu: { name: "Ryzen 5 5600X", price: 199 },
    gpu: { name: "RTX 3060", price: 329 },
    ram: { name: "16GB DDR4", price: 79 },
    mobo: { name: "B550 Board", price: 129 },
    psu: { name: "650W PSU", price: 89 },
  },
  totalPrice: 825,
  budget: 1000,
  issues: [],
};

const buildMocks = vi.hoisted(() => ({
  useBuild: vi.fn(),
  getCurrentUser: vi.fn(),
  createSavedBuild: vi.fn(),
}));

vi.mock("../context/BuildContext", () => ({
  useBuild: buildMocks.useBuild,
}));

vi.mock("../services/authApi", () => ({
  getCurrentUser: buildMocks.getCurrentUser,
}));

vi.mock("../services/buildApi", () => ({
  createSavedBuild: buildMocks.createSavedBuild,
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    Link: actual.Link,
  };
});

describe("Build", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    buildMocks.useBuild.mockReturnValue(buildState);
  });

  test("shows a sign-in error when the user is not authenticated", async () => {
    buildMocks.getCurrentUser.mockResolvedValue(null);

    render(
      <MemoryRouter>
        <Build />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: "Save This Build" }));

    expect(await screen.findByText("Please sign in first to save builds to your dashboard.")).toBeInTheDocument();
    expect(buildMocks.createSavedBuild).not.toHaveBeenCalled();
  });

  test("saves the build through the backend and shows a success message", async () => {
    buildMocks.getCurrentUser.mockResolvedValue({ id: 7, email: "user@example.com" });
    buildMocks.createSavedBuild.mockResolvedValue({ id: 42 });

    render(
      <MemoryRouter>
        <Build />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: "Save This Build" }));

    await waitFor(() => {
      expect(buildMocks.createSavedBuild).toHaveBeenCalledWith({
        title: "Ryzen 5 5600X + RTX 3060",
        totalPrice: 825,
        budget: 1000,
        compatible: true,
        parts: {
          cpu: { name: "Ryzen 5 5600X", price: 199, pos: "top" },
          gpu: { name: "RTX 3060", price: 329, pos: "left" },
          ram: { name: "16GB DDR4", price: 79, pos: "right" },
          mobo: { name: "B550 Board", price: 129, pos: "bottomLeft" },
          psu: { name: "650W PSU", price: 89, pos: "bottomRight" },
        },
      });
    });

    expect(await screen.findByText("Build saved. You can view it in Saved Builds.")).toBeInTheDocument();
  });
});
