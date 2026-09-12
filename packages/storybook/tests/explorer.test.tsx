import type { ReactNode } from "react";
import * as Gtk from "@gtkx/gi/gtk";
import { AdwAlertDialog, AdwWindow } from "@gtkx/jsx/adw";
import { GtkBox, GtkButton, GtkLabel } from "@gtkx/jsx/gtk";
import { rootElement, useApplication, useParentWindow } from "@gtkx/react";
import { act, render, screen, userEvent } from "@gtkx/testing";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { StoryCatalog } from "../src/catalog.js";
import { Storybook } from "../src/explorer-view.js";
import * as counterStories from "./fixtures/counter.stories.js";

const loadCounter = async (): Promise<StoryCatalog> => {
    const catalog = new StoryCatalog();
    await catalog.load([{ id: "counter.stories.tsx", title: "Counter", load: () => Promise.resolve(counterStories) }]);

    return catalog;
};

const showExplorer = (catalog: StoryCatalog) => render(<Storybook catalog={catalog} />, { container: rootElement });

const Presentation = (): ReactNode => {
    const application = useApplication();
    const parent = useParentWindow();
    const [isOpen, setIsOpen] = useState(false);

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL}>
            <GtkLabel name="story-application">{application.getApplicationId() ?? "No application"}</GtkLabel>
            <GtkLabel name="story-parent">{parent?.getTitle() ?? "No parent"}</GtkLabel>
            <GtkButton
                label="Open dialog"
                onClicked={() => {
                    setIsOpen(true);
                }}
            />
            {isOpen && (
                <AdwAlertDialog
                    heading="Story dialog"
                    responses={[{ id: "close", label: "Close dialog" }]}
                    onResponse={() => {
                        setIsOpen(false);
                    }}
                />
            )}
        </GtkBox>
    );
};

describe("native story explorer", () => {
    it("selects, interacts with, resets, and switches native stories", async () => {
        const catalog = await loadCounter();
        await showExplorer(catalog);

        await userEvent.click(screen.getByName("storybook-story-components-counter--default"));
        expect(screen.getByName("count")).toHaveTextContent(/^2$/);
        await userEvent.click(screen.getByRole(Gtk.AccessibleRole.BUTTON, { name: "Increment" }));
        expect(screen.getByName("count")).toHaveTextContent(/^3$/);
        await userEvent.click(screen.getByRole(Gtk.AccessibleRole.BUTTON, { name: "Reset story" }));
        expect(screen.getByName("count")).toHaveTextContent(/^2$/);

        await userEvent.click(screen.getByName("storybook-story-components-counter--with-step"));
        await userEvent.click(screen.getByRole(Gtk.AccessibleRole.BUTTON, { name: "Increment" }));
        expect(screen.getByName("count")).toHaveTextContent(/^5$/);
        await userEvent.click(screen.getByName("storybook-story-components-counter--default"));
        expect(screen.getByName("count")).toHaveTextContent(/^2$/);
    });

    it("filters navigation without discarding the current preview state", async () => {
        const catalog = await loadCounter();
        await showExplorer(catalog);

        await userEvent.click(screen.getByName("storybook-story-components-counter--default"));
        await userEvent.click(screen.getByRole(Gtk.AccessibleRole.BUTTON, { name: "Increment" }));
        const search = screen.getByName("storybook-search");
        await userEvent.type(search, "with step");

        expect(screen.queryByName("storybook-story-components-counter--default")).toBeNull();
        expect(screen.getByName("storybook-story-components-counter--with-step")).toBeVisible();
        expect(screen.getByName("count")).toHaveTextContent(/^3$/);

        await userEvent.clear(search);
        await userEvent.type(search, "no matching example");
        expect(screen.queryByName("storybook-story-components-counter--with-step")).toBeNull();
        expect(screen.getByName("count")).toHaveTextContent(/^3$/);
        await userEvent.clear(search);
        expect(screen.getByName("storybook-story-components-counter--default")).toBeVisible();
    });

    it("starts empty and updates after stories are loaded and removed", async () => {
        const catalog = new StoryCatalog();
        await showExplorer(catalog);
        expect(screen.queryByName("count")).toBeNull();

        await act(() => catalog.load([{
            id: "counter.stories.tsx", title: "Counter", load: () => Promise.resolve(counterStories),
        }]));
        await userEvent.click(screen.getByName("storybook-story-components-counter--default"));
        expect(screen.getByName("count")).toHaveTextContent(/^2$/);

        await act(() => catalog.load([]));
        expect(screen.queryByName("count")).toBeNull();
        expect(screen.queryByName("storybook-story-components-counter--default")).toBeNull();
    });

    it("recomposes the selected story after metadata replacement", async () => {
        const catalog = await loadCounter();
        await showExplorer(catalog);
        await userEvent.click(screen.getByName("storybook-story-components-counter--default"));
        await userEvent.click(screen.getByRole(Gtk.AccessibleRole.BUTTON, { name: "Increment" }));

        await act(() => catalog.load([{
            id: "counter.stories.tsx", title: "Counter",
            load: () => Promise.resolve({
                ...counterStories,
                default: {
                    ...counterStories.default,
                    args: { ...counterStories.default.args, initialCount: 40, label: "Updated increment" },
                },
            }),
        }]));

        expect(screen.getByName("count")).toHaveTextContent(/^40$/);
        await userEvent.click(screen.getByRole(Gtk.AccessibleRole.BUTTON, { name: "Updated increment" }));
        expect(screen.getByName("count")).toHaveTextContent(/^41$/);
    });

    it("retains initial selection when earlier stories appear and persists the fallback after removal", async () => {
        const catalog = await loadCounter();
        await showExplorer(catalog);
        await userEvent.click(screen.getByRole(Gtk.AccessibleRole.BUTTON, { name: "Increment" }));
        const earlierModule = {
            default: { title: "Earlier", render: () => <GtkLabel name="earlier-story">Earlier</GtkLabel> },
            Default: {},
        };
        const earlier = { id: "earlier.stories.tsx", title: "Earlier", load: () => Promise.resolve(earlierModule) };
        const counter = { id: "counter.stories.tsx", title: "Counter", load: () => Promise.resolve(counterStories) };

        await act(() => catalog.load([earlier, counter]));
        expect(screen.getByName("count")).toHaveTextContent(/^3$/);
        expect(screen.getByName("storybook-story-earlier--default")).toBeVisible();
        await act(() => catalog.load([earlier]));
        expect(screen.queryByName("count")).toBeNull();
        expect(screen.getByName("earlier-story")).toBeVisible();

        await act(() => catalog.load([counter, earlier]));
        expect(screen.queryByName("count")).toBeNull();
        expect(screen.getByName("earlier-story")).toBeVisible();
    });

    it("preserves application and parent window context and dismisses owned dialogs on unmount", async () => {
        const catalog = new StoryCatalog();
        await catalog.load([{
            id: "presentation.stories.tsx", title: "Presentation",
            load: () => Promise.resolve({ default: { title: "Presentation", component: Presentation }, Default: {} }),
        }]);
        const result = await showExplorer(catalog);

        expect(screen.getByName("story-application")).toHaveTextContent("org.gtkx.Storybook");
        expect(screen.getByName("story-parent")).toHaveTextContent("GTKX Storybook");
        await userEvent.click(screen.getByRole(Gtk.AccessibleRole.BUTTON, { name: "Open dialog" }));
        expect(await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Close dialog" })).toBeVisible();

        await userEvent.click(screen.getByRole(Gtk.AccessibleRole.BUTTON, { name: "Close dialog" }));
        await userEvent.click(screen.getByRole(Gtk.AccessibleRole.BUTTON, { name: "Open dialog" }));
        expect(await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Close dialog" })).toBeVisible();
        await result.unmount();
        expect(screen.queryByRole(Gtk.AccessibleRole.BUTTON, { name: "Close dialog" })).toBeNull();
        expect(screen.queryByRole(Gtk.AccessibleRole.WINDOW, { name: "GTKX Storybook" })).toBeNull();
    });

    it("owns window story presentation and destroys old windows when switching", async () => {
        const catalog = new StoryCatalog();
        await catalog.load([{
            id: "windows.stories.tsx", title: "Windows",
            load: () => Promise.resolve({
                default: { title: "Windows" },
                First: {
                    parameters: { gtkx: { preview: "window" } },
                    render: () => <AdwWindow title="Story window"><GtkLabel>Window content</GtkLabel></AdwWindow>,
                },
                Second: { render: () => <GtkLabel>Embedded content</GtkLabel> },
            }),
        }]);
        const result = await showExplorer(catalog);
        const window = screen.getByRole(Gtk.AccessibleRole.WINDOW, { name: "Story window" });
        expect(window).toBeVisible();

        if (!(window instanceof Gtk.Window)) {
            throw new TypeError("Expected story window");
        }

        expect(window.getTransientFor()).toBe(screen.getByRole(Gtk.AccessibleRole.WINDOW, { name: "GTKX Storybook" }));
        await userEvent.click(screen.getByName("storybook-story-windows--second"));
        expect(screen.queryByRole(Gtk.AccessibleRole.WINDOW, { name: "Story window" })).toBeNull();
        await userEvent.click(screen.getByName("storybook-story-windows--first"));
        expect(screen.getByRole(Gtk.AccessibleRole.WINDOW, { name: "Story window" })).toBeVisible();
        await result.unmount();
        expect(screen.queryByRole(Gtk.AccessibleRole.WINDOW, { name: "Story window" })).toBeNull();
    });

    it("keeps navigation usable after a selected story throws during rendering", async () => {
        const catalog = new StoryCatalog();
        await catalog.load([{
            id: "recovery.stories.tsx", title: "Recovery",
            load: () => Promise.resolve({
                default: { title: "Recovery" },
                Healthy: { render: () => <GtkLabel name="healthy-story">Healthy</GtkLabel> },
                Broken: { render: (): ReactNode => {
                    throw new Error("Broken story");
                } },
            }),
        }]);
        const result = await showExplorer(catalog);
        await userEvent.click(screen.getByName("storybook-story-recovery--broken"));
        await expect(result.rerender(<Storybook catalog={catalog} />)).rejects.toThrow();

        await userEvent.click(screen.getByName("storybook-story-recovery--healthy"));
        expect(screen.getByName("healthy-story")).toBeVisible();
        await userEvent.click(screen.getByRole(Gtk.AccessibleRole.BUTTON, { name: "Reset story" }));
        expect(screen.getByName("healthy-story")).toBeVisible();
    });
});
