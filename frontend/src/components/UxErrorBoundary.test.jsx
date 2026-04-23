import { render, screen } from "@testing-library/react";
import { describe, expect, test, vi, beforeEach, afterEach } from "vitest";
import UxErrorBoundary from "./UxErrorBoundary";

function CrashOnRender() {
  throw new Error("Boom");
}

describe("UxErrorBoundary", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("renders children when there are no errors", () => {
    render(
      <UxErrorBoundary>
        <div>Safe content</div>
      </UxErrorBoundary>
    );

    expect(screen.getByText("Safe content")).toBeInTheDocument();
  });

  test("shows fallback UI when a child crashes", () => {
    render(
      <UxErrorBoundary>
        <CrashOnRender />
      </UxErrorBoundary>
    );

    expect(screen.getByRole("heading", { name: "Something went wrong" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try Again" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Go Home" })).toBeInTheDocument();
  });
});