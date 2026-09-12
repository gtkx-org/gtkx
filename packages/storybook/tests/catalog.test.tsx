import type { Meta, Preview } from "@gtkx/storybook";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkButton, GtkLabel } from "@gtkx/jsx/gtk";
import { rootElement } from "@gtkx/react";
import { Storybook, StoryCatalog } from "@gtkx/storybook/explorer";
import { act, render, screen, userEvent } from "@gtkx/testing";
import { describe, expect, it } from "vitest";

const moduleWithLabel = (label: string) => ({
    default: { render: () => <GtkLabel>{label}</GtkLabel> } satisfies Meta,
    Default: {},
});

describe("native story catalog updates", () => {
    it("displays discovered titles, story names, and control names as literal text", async () => {
        const catalog = new StoryCatalog();
        const title = "Widgets <b>& things</b>";
        const name = "Example <i>& details</i>";
        await catalog.load([{
            id: "literal.stories.tsx",
            title,
            load: () => Promise.resolve({
                default: {
                    id: "literal",
                    args: { label: "Click <b>& continue</b>" },
                    argTypes: { label: { name: "Label <i>& text</i>", control: "text" } },
                    render: (args) => <GtkButton label={String(args.label)} />,
                } satisfies Meta,
                Default: { name },
            }),
        }]);
        await render(<Storybook catalog={catalog} />, { container: rootElement });

        expect(screen.getByRole(Gtk.AccessibleRole.LIST_ITEM, { name })).toBeVisible();
        expect(screen.getAllByText(title).length).toBeGreaterThan(0);
        expect(screen.getByName("storybook-control-label")).toHaveAccessibleName(/Label <i>& text<\/i>/);
        expect(screen.getByRole(Gtk.AccessibleRole.BUTTON, { name: "Click <b>& continue</b>" })).toBeVisible();
    });

    it.each(["success", "failure"])("ignores an outdated module load finishing with %s", async (outcome) => {
        const catalog = new StoryCatalog();
        const pending = Promise.withResolvers<unknown>();
        let previousLoad = Promise.resolve();
        await render(<Storybook catalog={catalog} />, { container: rootElement });
        await act(() => {
            previousLoad = catalog.load([{ id: "old.stories.tsx", title: "Old", load: () => pending.promise }]);
        });
        await act(() => catalog.load([{
            id: "new.stories.tsx", title: "New", load: () => Promise.resolve(moduleWithLabel("Newest preview")),
        }]));
        expect(screen.getByText("Newest preview")).toBeVisible();

        await act(async () => {
            if (outcome === "success") {
                pending.resolve(moduleWithLabel("Outdated preview"));
            } else {
                pending.reject(new Error("Outdated import failure"));
            }

            await previousLoad;
        });

        expect(screen.getByText("Newest preview")).toBeVisible();
        expect(screen.queryByText("Outdated preview")).toBeNull();
        expect(screen.queryByName("storybook-story-old--default")).toBeNull();
    });

    it("rejects duplicate identifiers while keeping healthy stories usable and recovers after removal", async () => {
        const catalog = new StoryCatalog();
        const first = {
            id: "first.stories.tsx", title: "Shared", load: () => Promise.resolve(moduleWithLabel("First")),
        };
        const second = {
            id: "second.stories.tsx", title: "Shared", load: () => Promise.resolve(moduleWithLabel("Second")),
        };
        const healthy = {
            id: "healthy.stories.tsx",
            title: "Healthy",
            load: () => Promise.resolve(moduleWithLabel("Healthy preview")),
        };

        await expect(catalog.load([first, second, healthy])).rejects.toThrow();
        await render(<Storybook catalog={catalog} />, { container: rootElement });
        expect(screen.getByText("Healthy preview")).toBeVisible();
        expect(screen.queryByName("storybook-story-shared--default")).toBeNull();

        await act(() => catalog.load([first, healthy]));
        await userEvent.click(screen.getByName("storybook-story-shared--default"));
        expect(screen.getByText("First")).toBeVisible();
        expect(screen.queryByText("Second")).toBeNull();
    });

    it.each([42, false, { label: "Invalid" }])("rejects invalid display names during loading", async (name) => {
        const catalog = new StoryCatalog();

        await expect(catalog.load([{
            id: "invalid.stories.js",
            title: "Invalid",
            load: () => Promise.resolve({
                ...moduleWithLabel("Invalid preview"),
                Default: { name },
            }),
        }])).rejects.toThrow();
    });

    it("uses explicit control precedence and leaves inferred arguments out of the inspector", async () => {
        const catalog = new StoryCatalog();
        const preview = {
            argTypes: {
                inherited: { control: "text" },
                hiddenByMeta: { control: "text" },
            },
        } satisfies Preview;
        await catalog.load([{
            id: "controls.stories.tsx",
            title: "Controls",
            load: () => Promise.resolve({
                default: {
                    args: {
                        inherited: "Inherited", hiddenByMeta: "Meta", hiddenByStory: "Story", inferred: "Inferred",
                    },
                    argTypes: { hiddenByMeta: { control: false }, hiddenByStory: { control: "text" } },
                    render: () => <GtkLabel>Control precedence preview</GtkLabel>,
                } satisfies Meta,
                Default: { argTypes: { hiddenByStory: { control: false } } },
                Editable: { argTypes: { hiddenByMeta: { control: "text" } } },
            }),
        }], preview);
        await render(<Storybook catalog={catalog} />, { container: rootElement });

        expect(screen.getByName("storybook-control-inherited")).toBeVisible();
        expect(screen.queryByName("storybook-control-hiddenByMeta")).toBeNull();
        expect(screen.queryByName("storybook-control-hiddenByStory")).toBeNull();
        expect(screen.queryByName("storybook-control-inferred")).toBeNull();

        await userEvent.click(screen.getByName("storybook-story-controls--editable"));
        expect(screen.getByName("storybook-control-hiddenByMeta")).toBeVisible();
        expect(screen.getByName("storybook-control-hiddenByStory")).toBeVisible();
        expect(screen.queryByName("storybook-control-inferred")).toBeNull();
    });
});
