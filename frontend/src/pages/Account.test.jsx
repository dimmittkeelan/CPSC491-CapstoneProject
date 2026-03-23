import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, test, expect, vi, beforeEach } from "vitest";
import Account from "./Account";

const mockNavigate = vi.fn();

vi.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
}));

const authMocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  updateEmail: vi.fn(),
  updatePassword: vi.fn(),
  deleteAccount: vi.fn(),
}));

vi.mock("../services/authApi", () => ({
  getCurrentUser: authMocks.getCurrentUser,
  updateEmail: authMocks.updateEmail,
  updatePassword: authMocks.updatePassword,
  deleteAccount: authMocks.deleteAccount,
}));

describe("Account", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.getCurrentUser.mockResolvedValue({ email: "user@example.com" });
  });

  test("redirects to login when no authenticated user exists", async () => {
    authMocks.getCurrentUser.mockResolvedValue(null);

    render(<Account />);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/login");
    });
  });

  test("shows password mismatch error and does not call updatePassword", async () => {
    render(<Account />);

    await screen.findByText("Account Settings");

    fireEvent.change(screen.getByLabelText("Current Password", { selector: "#currentPassword" }), {
      target: { value: "old-password" },
    });
    fireEvent.change(screen.getByLabelText("New Password"), {
      target: { value: "new-password-123" },
    });
    fireEvent.change(screen.getByLabelText("Confirm New Password"), {
      target: { value: "different-password-456" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Update Password" }));

    expect(await screen.findByText("New passwords do not match")).toBeInTheDocument();
    expect(authMocks.updatePassword).not.toHaveBeenCalled();
  });

  test("updates email and reflects the new email on success", async () => {
    authMocks.updateEmail.mockResolvedValue({
      user: { email: "new-email@example.com" },
    });

    render(<Account />);

    await screen.findByText("Account Settings");

    fireEvent.change(screen.getByLabelText("New Email Address"), {
      target: { value: "new-email@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Current Password", { selector: "#emailPassword" }), {
      target: { value: "secure-password" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Update Email" }));

    await waitFor(() => {
      expect(authMocks.updateEmail).toHaveBeenCalledWith("secure-password", "new-email@example.com");
    });

    expect(await screen.findByText("Email updated successfully")).toBeInTheDocument();
    expect(screen.getByText("new-email@example.com")).toBeInTheDocument();
  });
});
