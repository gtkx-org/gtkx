import * as Gtk from "@gtkx/gi/gtk";
import { render, screen, userEvent, waitFor } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { expectSelectedTab, findTab, TabsApp } from "./helpers/tab-fixtures.js";

describe.each(["top", "bottom"] as const)("tabs - %s mnemonics", (tabBarPosition) => {
    it("switches to a tab with Alt and its title mnemonic", async () => {
        await render(
            <TabsApp
                navigator={{ tabBarPosition, screenOptions: { useUnderline: true } }}
                options={{ Second: { title: "_Second" } }}
            />,
        );
        const content = await screen.findByText("First Content");
        expect(await findTab("Second")).toBeVisible();
        await userEvent.keyboard(content, "{Alt>}s{/Alt}");
        expect(await screen.findByText("Second Content")).toBeVisible();
        expect(screen.queryByText("First Content")).toBeNull();
        expectSelectedTab("Second");
    });

    it("uses tabBarLabel mnemonics and displays escaped underscores", async () => {
        await render(
            <TabsApp
                navigator={{ tabBarPosition }}
                options={{ Second: { title: "_Other", tabBarLabel: "_Files__and__folders", useUnderline: true } }}
            />,
        );
        const content = await screen.findByText("First Content");
        expect(await findTab("Files_and_folders")).toBeVisible();
        await userEvent.keyboard(content, "{Alt>}o{/Alt}");
        expect(screen.getByText("First Content")).toBeVisible();
        expect(screen.queryByText("Second Content")).toBeNull();
        await userEvent.keyboard(content, "{Alt>}f{/Alt}");
        expect(await screen.findByText("Second Content")).toBeVisible();
        expectSelectedTab("Files_and_folders");
    });

    it("keeps underscores literal and leaves mnemonics disabled by default", async () => {
        await render(
            <TabsApp navigator={{ tabBarPosition }} options={{ Second: { tabBarLabel: "_Second__tab" } }} />,
        );
        const content = await screen.findByText("First Content");
        const tab = await findTab("_Second__tab");
        await userEvent.keyboard(content, "{Alt>}s{/Alt}");
        expect(screen.getByText("First Content")).toBeVisible();
        expect(screen.queryByText("Second Content")).toBeNull();
        expectSelectedTab("First Tab");
        await userEvent.click(tab);
        expect(await screen.findByText("Second Content")).toBeVisible();
    });

    it("updates and disables the mnemonic when screen options change", async () => {
        const { rerender } = await render(
            <TabsApp
                navigator={{ tabBarPosition }}
                options={{ Second: { tabBarLabel: "_Second", useUnderline: true } }}
            />,
        );
        await screen.findByText("First Content");
        await findTab("Second");
        await rerender(
            <TabsApp
                navigator={{ tabBarPosition }}
                options={{ Second: { tabBarLabel: "_Archive", useUnderline: true } }}
            />,
        );
        await findTab("Archive");
        await userEvent.keyboard(screen.getByText("First Content"), "{Alt>}s{/Alt}");
        expect(screen.queryByText("Second Content")).toBeNull();
        await userEvent.keyboard(screen.getByText("First Content"), "{Alt>}a{/Alt}");
        expect(await screen.findByText("Second Content")).toBeVisible();
        await userEvent.click(await findTab("First Tab"));
        await screen.findByText("First Content");
        await rerender(
            <TabsApp
                navigator={{ tabBarPosition }}
                options={{ Second: { tabBarLabel: "_Archive", useUnderline: false } }}
            />,
        );
        expect(await findTab("_Archive")).toBeVisible();
        await userEvent.keyboard(screen.getByText("First Content"), "{Alt>}a{/Alt}");
        expect(screen.getByText("First Content")).toBeVisible();
        expect(screen.queryByText("Second Content")).toBeNull();
    });

    it("keeps the current tab when its mnemonic press is prevented", async () => {
        let presses = 0;
        await render(
            <TabsApp
                navigator={{ tabBarPosition }}
                options={{ Second: { tabBarLabel: "_Second", useUnderline: true } }}
                listeners={{
                    Second: {
                        tabPress: (event) => {
                            presses += 1;
                            event.preventDefault();
                        },
                    },
                }}
            />,
        );
        await userEvent.keyboard(await screen.findByText("First Content"), "{Alt>}s{/Alt}");
        await waitFor(() => {
            expect(presses).toBe(1);
            expectSelectedTab("First Tab");
        });
        expect(screen.getByText("First Content")).toBeVisible();
        expect(screen.queryByText("Second Content")).toBeNull();
        expect(screen.getByRole(Gtk.AccessibleRole.TAB, { name: "Second" })).toHaveAccessibleState(
            Gtk.AccessibleState.SELECTED,
            false,
        );
    });
});
