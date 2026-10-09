import { GtkLabel } from "@gtkx/jsx/gtk";
import { startStorybook } from "@gtkx/storybook/explorer";
import { act, render, screen } from "@gtkx/testing";
import { expect, it } from "vitest";

it("loads, updates and stops a public explorer session", async () => {
    await render(<GtkLabel>Session harness</GtkLabel>);
    const session = await act(() => startStorybook({ applicationId: "org.gtkx.storybook.session" }));
    const source = (label: string) => ({
        id: "session.stories.tsx",
        title: "Session",
        load: () =>
            Promise.resolve({
                default: { title: "Session", render: () => <GtkLabel>{label}</GtkLabel> },
                Default: {},
            }),
    });

    try {
        await act(() => session.updateStories([source("First preview")]));
        expect(await screen.findByText("First preview")).toBeVisible();
        await act(() => session.reportStorybookError(new Error("Source unavailable")));
        expect(screen.getByName("storybook-load-errors")).toHaveTextContent("Source unavailable");
        await act(() => session.updateStories([source("Updated preview")]));
        expect(await screen.findByText("Updated preview")).toBeVisible();
        expect(screen.queryByText("First preview")).toBeNull();
        expect(screen.queryByName("storybook-load-errors")).toBeNull();
    } finally {
        await act(() => session.stop());
    }

    expect(screen.queryByText("Updated preview")).toBeNull();
});
