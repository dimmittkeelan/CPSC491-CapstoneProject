import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, test, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import SignUp from "./SignUp";

const authMocks = vi.hoisted(() => ({
  register: vi.fn(),
}));

vi.mock("../services/authApi", () => ({
  register: authMocks.register,
}));

describe("SignUp", () => {
  const originalLocation = window.location;

  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...originalLocation, replace: vi.fn() },
    });
  });

  test("shows validation error when passwords do not match", async () => {
    render(
      <MemoryRouter>
        <SignUp />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "user@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "strongpassword1" },
    });
    fireEvent.change(screen.getByLabelText("Confirm Password"), {
      target: { value: "strongpassword2" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Sign Up" }));

    expect(await screen.findByText("Passwords do not match.")).toBeInTheDocument();
    expect(authMocks.register).not.toHaveBeenCalled();
  });

  test("submits registration with marketing opt-in and redirects", async () => {
    authMocks.register.mockResolvedValue({ ok: true });

    render(
      <MemoryRouter>
        <SignUp />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "newuser@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "strongpassword123" },
    });
    fireEvent.change(screen.getByLabelText("Confirm Password"), {
      target: { value: "strongpassword123" },
    });
    fireEvent.click(screen.getByLabelText("Send me offers and promotions by email."));

    fireEvent.click(screen.getByRole("button", { name: "Sign Up" }));

    await waitFor(() => {
      expect(authMocks.register).toHaveBeenCalledWith(
        "newuser@example.com",
        "strongpassword123",
        { marketingOptIn: true }
      );
    });

    expect(window.location.replace).toHaveBeenCalledWith("/");
  });
});
