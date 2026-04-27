import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, test, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import SavedBuild from "./SavedBuild";

const savedBuildMocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  fetchSavedBuilds: vi.fn(),
  deleteSavedBuild: vi.fn(),
}));

vi.mock("../services/authApi", () => ({
  getCurrentUser: savedBuildMocks.getCurrentUser,
}));

vi.mock("../services/buildApi", () => ({
  fetchSavedBuilds: savedBuildMocks.fetchSavedBuilds,
  deleteSavedBuild: savedBuildMocks.deleteSavedBuild,
}));

describe("SavedBuild", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    savedBuildMocks.getCurrentUser.mockResolvedValue({ id: 7, email: "user@example.com" });
  });

  test("renders builds fetched from the backend", async () => {
    savedBuildMocks.fetchSavedBuilds.mockResolvedValue([
      {
        id: 1,
        title: "Balanced Build",
        createdAt: "2026-04-01T10:00:00.000Z",
        totalPrice: 900,
        budget: 1000,
        compatible: true,
        performanceScore: 78,
        parts: {
          cpu: { name: "Ryzen 5 5600X" },
          gpu: { name: "RTX 3060" },
        },
      },
    ]);

    render(
      <MemoryRouter>
        <SavedBuild />
      </MemoryRouter>
    );

    expect(await screen.findByText("Balanced Build")).toBeInTheDocument();
    expect(screen.getByText("Total: $900")).toBeInTheDocument();
    expect(screen.getByText("Performance: 78%")).toBeInTheDocument();
  });

  test("deletes a saved build through the backend", async () => {
    savedBuildMocks.fetchSavedBuilds.mockResolvedValue([
      {
        id: 12,
        title: "Delete Me",
        createdAt: "2026-04-01T10:00:00.000Z",
        totalPrice: 700,
        budget: 800,
        compatible: true,
        performanceScore: 60,
        parts: {},
      },
    ]);
    savedBuildMocks.deleteSavedBuild.mockResolvedValue({ ok: true });

    render(
      <MemoryRouter>
        <SavedBuild />
      </MemoryRouter>
    );

    await screen.findByText("Delete Me");
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));

    await waitFor(() => {
      expect(savedBuildMocks.deleteSavedBuild).toHaveBeenCalledWith(12);
    });

    await waitFor(() => {
      expect(screen.queryByText("Delete Me")).toBeNull();
    });
  });
});
