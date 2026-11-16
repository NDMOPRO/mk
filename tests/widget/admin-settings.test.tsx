/**
 * Admin Settings page after the split into client/src/pages/admin-settings.
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import React from "react";

const update = vi.fn();
const settingsData = { "site.nameAr": "المفتاح الشهري", "site.nameEn": "Monthly Key" };

// Every trpc.<router>.<procedure> resolves to a stub with useQuery/useMutation.
function stub(): any {
  return new Proxy(() => {}, {
    get(_t, prop) {
      if (prop === "useQuery") return () => ({ data: undefined, isLoading: false, isError: false, refetch: vi.fn() });
      if (prop === "useMutation") return () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false });
      if (prop === "useUtils") return () => stub();
      return stub();
    },
  });
}
vi.mock("@/lib/trpc", () => {
  const root: any = new Proxy({}, {
    get(_t, prop) {
      if (prop === "siteSettings") {
        return {
          getAll: { useQuery: () => ({ data: settingsData, isLoading: false, isError: false, refetch: vi.fn() }) },
          update: { useMutation: () => ({ mutate: update, isPending: false }) },
          seed: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
          uploadAsset: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
        };
      }
      return stub();
    },
  });
  return { trpc: root };
});
vi.mock("@/lib/i18n", () => ({ useI18n: () => ({ t: (k: string) => k, lang: "en", dir: "ltr" }) }));
vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: 1, role: "admin" } }) }));
vi.mock("@/components/DashboardLayout", () => ({ default: ({ children }: any) => <div>{children}</div> }));
vi.mock("@/components/SEOHead", () => ({ default: () => null }));

const { default: AdminSettings } = await import("@/pages/AdminSettings");

afterEach(cleanup);

describe("Admin Settings page", () => {
  it("renders the general tab with values from the server", () => {
    render(<AdminSettings />);
    expect(screen.getByDisplayValue("Monthly Key")).toBeTruthy();
    expect(screen.getByDisplayValue("المفتاح الشهري")).toBeTruthy();
  });

  it("keeps the same input focused while typing, and saves the new value", () => {
    render(<AdminSettings />);
    const input = screen.getByDisplayValue("Monthly Key") as HTMLInputElement;
    input.focus();
    fireEvent.change(input, { target: { value: "Monthly Key!" } });
    // The field components used to be redefined on every render, which
    // replaced the input (and dropped focus) after each keystroke.
    expect(document.activeElement).toBe(input);
    expect(input.value).toBe("Monthly Key!");

    fireEvent.click(screen.getAllByText("settings.save")[0]);
    expect(update).toHaveBeenCalledWith({ settings: expect.objectContaining({ "site.nameEn": "Monthly Key!" }) });
  });

  it("every tab renders", () => {
    render(<AdminSettings />);
    const tabs = screen.getAllByRole("tab");
    expect(tabs.length).toBe(18);
    for (const tab of tabs) {
      fireEvent.mouseDown(tab, { button: 0 });
      expect(tab.getAttribute("data-state")).toBe("active");
      expect(screen.getByRole("tabpanel")).toBeTruthy();
    }
  });
});
