import * as Gtk from "@gtkx/gi/gtk";
import { render, screen, userEvent, waitFor } from "@gtkx/testing";
import { describe, expect, it, vi } from "vitest";
import {
    expectSelectedTab,
    expectUnselectedTab,
    findTab,
    focusedRouteName,
    lastState,
    type StateSpy,
    TabsApp,
} from "./helpers/tab-fixtures.js";

describe("tabs - switching", () => {
    it("shows the clicked tab and hides the previous one", async () => {
        await render(<TabsApp />);
        await screen.findByText("First Content");
        expect(screen.queryByText("Second Content")).toBeNull();
        expectSelectedTab("First Tab");
        await userEvent.click(await findTab("Second Tab"));
        await screen.findByText("Second Content");

        await waitFor(() => {
            expect(screen.queryByText("First Content")).toBeNull();
        });

        expectSelectedTab("Second Tab");
        expectUnselectedTab("First Tab");
    });

    it("switches tabs with navigate from a screen", async () => {
        const onStateChange: StateSpy = vi.fn();
        await render(<TabsApp onStateChange={onStateChange} />);
        await userEvent.click(await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Navigate to Second" }));
        await screen.findByText("Second Content");
        expect(screen.queryByText("First Content")).toBeNull();

        await waitFor(() => {
            expectSelectedTab("Second Tab");
        });

        expectUnselectedTab("First Tab");
        expect(focusedRouteName(onStateChange)).toBe("Second");
    });

    it("switches tabs with jumpTo from a screen", async () => {
        const onStateChange: StateSpy = vi.fn();
        await render(<TabsApp onStateChange={onStateChange} />);
        await userEvent.click(await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Jump to Third" }));
        await screen.findByText("Third Content");
        expect(screen.queryByText("First Content")).toBeNull();

        await waitFor(() => {
            expectSelectedTab("Third Tab");
        });

        expect(focusedRouteName(onStateChange)).toBe("Third");
    });

    it("reports tab states to onStateChange", async () => {
        const onStateChange: StateSpy = vi.fn();
        await render(<TabsApp onStateChange={onStateChange} />);
        await userEvent.click(await findTab("Third Tab"));
        await screen.findByText("Third Content");
        expect(onStateChange).toHaveBeenCalledTimes(1);
        expect(lastState(onStateChange)?.type).toBe("tab");
        expect(focusedRouteName(onStateChange)).toBe("Third");
    });

    it("selects the initial route", async () => {
        await render(<TabsApp navigator={{ initialRouteName: "Second" }} />);
        await screen.findByText("Second Content");
        expect(screen.queryByText("First Content")).toBeNull();
        expectSelectedTab("Second Tab");
        expectUnselectedTab("First Tab");
    });

    it("returns to the previous tab on goBack with backBehavior history", async () => {
        await render(<TabsApp navigator={{ backBehavior: "history" }} />);
        await userEvent.click(await findTab("Second Tab"));
        await screen.findByText("Second Content");
        await userEvent.click(await findTab("Third Tab"));
        await screen.findByText("Third Content");
        await userEvent.click(screen.getByRole(Gtk.AccessibleRole.BUTTON, { name: "Go back" }));
        await screen.findByText("Second Content");
        expect(screen.queryByText("Third Content")).toBeNull();

        await waitFor(() => {
            expectSelectedTab("Second Tab");
        });
    });

    it("returns to the first tab on goBack by default", async () => {
        await render(<TabsApp />);
        await userEvent.click(await findTab("Second Tab"));
        await screen.findByText("Second Content");
        await userEvent.click(await findTab("Third Tab"));
        await screen.findByText("Third Content");
        await userEvent.click(screen.getByRole(Gtk.AccessibleRole.BUTTON, { name: "Go back" }));
        await screen.findByText("First Content");
        expect(screen.queryByText("Third Content")).toBeNull();
    });
});
