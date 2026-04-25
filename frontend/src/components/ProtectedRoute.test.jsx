import { render, screen } from "@testing-library/react";
import { describe, expect, test, vi, beforeEach } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import ProtectedRoute from "./ProtectedRoute";

const authMocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
}));

vi.mock("../services/authApi", () => ({
  getCurrentUser: authMocks.getCurrentUser,
}));

describe("ProtectedRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("renders protected content when user is authenticated", async () => {
    authMocks.getCurrentUser.mockResolvedValue({ email: "user@example.com" });

    render(
      <MemoryRouter initialEntries={["/saved"]}>
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route path="/saved" element={<p>Saved content</p>} />
          </Route>
          <Route path="/login" element={<p>Login page</p>} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText("Saved content")).toBeInTheDocument();
  });

  test("redirects to login when user is not authenticated", async () => {
    authMocks.getCurrentUser.mockResolvedValue(null);

    render(
      <MemoryRouter initialEntries={["/saved"]}>
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route path="/saved" element={<p>Saved content</p>} />
          </Route>
          <Route path="/login" element={<p>Login page</p>} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText("Login page")).toBeInTheDocument();
  });
});