import * as Adw from "@gtkx/gi/adw";
import * as Gtk from "@gtkx/gi/gtk";
import * as GtkSource from "@gtkx/gi/gtksource";
import { GtkBox } from "@gtkx/jsx/gtk";
import { act, render, screen, userEvent, waitFor, within } from "@gtkx/testing";
import { assert, describe, expect, it } from "vitest";
import type { Demo } from "../../src/demos/types.js";
import { Sidebar } from "../../src/components/sidebar.js";
import { SourceViewer } from "../../src/components/source-viewer.js";
import { DemoProvider } from "../../src/context/demo-context.js";

const intro: Demo = { id: "intro", title: "GTK Demo", description: "Introduction", keywords: [] };
const sidebarWidget = (): Gtk.ListView =>
    screen.getByRole(Gtk.AccessibleRole.LIST, { name: "Demos", as: Gtk.ListView });
const sourceView = (): GtkSource.View | null =>
    screen.queryByRole(Gtk.AccessibleRole.TEXT_BOX, { name: "Source code", as: GtkSource.View });

const renderWithSelectedDemo = async (demos: Demo[], selected: Demo): Promise<void> => {
    await render(
        <DemoProvider demos={demos}>
            <GtkBox>
                <Sidebar
                    isSearchActive={false}
                    onDemoActivated={() => null}
                    onSearchActiveChange={() => null}
                    onSearchChanged={() => null}
                />
                <SourceViewer />
            </GtkBox>
        </DemoProvider>,
    );
    await userEvent.click(within(sidebarWidget()).getByText(selected.title));
};

describe("SourceViewer", () => {
    it("shows the 'No source' placeholder for the selected introduction", async () => {
        await render(
            <DemoProvider demos={[intro]}>
                <SourceViewer />
            </DemoProvider>,
        );

        await screen.findByText("No source");
        expect(sourceView()).toBeNull();
    });

    it("shows the 'No source' placeholder when the current demo has no sourceCode", async () => {
        const withoutSource: Demo = {
            id: "no-source",
            title: "Without Source",
            description: "Has no source attached",
            keywords: [],
            component: () => null,
        };

        await renderWithSelectedDemo([intro, withoutSource], withoutSource);
        await screen.findByText("No source");
        expect(sourceView()).toBeNull();
    });

    it("updates the declarative buffer text when another demo is selected", async () => {
        const firstSource = "const x = 1;\n";
        const secondSource = "const y = 2;\n";

        const first: Demo = {
            id: "first-source",
            title: "First Source",
            description: "Has source attached",
            keywords: [],
            component: () => null,
            sourceCode: firstSource,
        };
        const second: Demo = {
            id: "second-source",
            title: "Second Source",
            description: "Has different source attached",
            keywords: [],
            component: () => null,
            sourceCode: secondSource,
        };

        await renderWithSelectedDemo([intro, first, second], first);
        const view = await screen.findByDisplayValue(firstSource);
        expect(view).toBeInstanceOf(GtkSource.View);
        expect(view).toHaveAccessibleName("Source code");
        expect(sourceView()).toBe(view);
        await userEvent.click(within(sidebarWidget()).getByText(second.title));
        expect(await screen.findByDisplayValue(secondSource)).toBe(view);
    });

    it("follows the effective Adwaita color scheme", async () => {
        const styleManager = Adw.StyleManager.getDefault();
        const sourceDemo: Demo = {
            id: "source",
            title: "Source",
            description: "Has source attached",
            keywords: [],
            component: () => null,
            sourceCode: "const value = true;\n",
        };

        try {
            await act(() => {
                styleManager.setColorScheme(Adw.ColorScheme.FORCE_LIGHT);
            });
            await render(
                <DemoProvider demos={[sourceDemo]}>
                    <SourceViewer />
                </DemoProvider>,
            );
            const view = await screen.findByRole(Gtk.AccessibleRole.TEXT_BOX, {
                name: "Source code",
                as: GtkSource.View,
            });
            const buffer = view.getBuffer();
            assert(buffer instanceof GtkSource.Buffer);
            expect(buffer.getStyleScheme()?.getId()).toBe("Adwaita");

            await act(() => {
                styleManager.setColorScheme(Adw.ColorScheme.FORCE_DARK);
            });
            await waitFor(() => {
                expect(buffer.getStyleScheme()?.getId()).toBe("Adwaita-dark");
            });
        } finally {
            await act(() => {
                styleManager.setColorScheme(Adw.ColorScheme.DEFAULT);
            });
        }
    });
});
