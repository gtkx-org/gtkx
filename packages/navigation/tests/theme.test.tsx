import type { ReactNode } from "react";
import * as Adw from "@gtkx/gi/adw";
import { GtkLabel } from "@gtkx/jsx/gtk";
import { DarkTheme, DefaultTheme, NavigationContainer, useTheme } from "@gtkx/navigation";
import { act, render, screen } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { expectText, Stack, ThemeLabel } from "./helpers/container-fixtures.js";

const ThemedStack = (): ReactNode => (
    <Stack.Navigator
        screenOptions={({ theme }) => ({
            headerEnd: <GtkLabel>{theme.dark ? "Dark header" : "Light header"}</GtkLabel>,
        })}
    >
        <Stack.Screen name="Home" component={ThemeLabel} />
    </Stack.Navigator>
);

const Unthemed = (): ReactNode => {
    const theme = useTheme();

    return <GtkLabel>{String(theme.dark)}</GtkLabel>;
};

const describeManager = (): string => {
    const manager = Adw.StyleManager.getDefault();

    return `dark=${String(manager.getDark())} highContrast=${String(manager.getHighContrast())}`;
};

const withColorScheme = async (scheme: Adw.ColorScheme, run: () => Promise<void>): Promise<void> => {
    const manager = Adw.StyleManager.getDefault();

    try {
        await act(() => {
            manager.setColorScheme(scheme);
        });

        await run();
    } finally {
        await act(() => {
            manager.setColorScheme(Adw.ColorScheme.DEFAULT);
        });
    }
};

describe("theme - useTheme", () => {
    it("matches the Adwaita style manager inside a screen", async () => {
        await render(
            <NavigationContainer>
                <ThemedStack />
            </NavigationContainer>,
        );

        await expectText(describeManager());
    });

    it("uses the theme prop instead of the style manager", async () => {
        await render(
            <NavigationContainer theme={DarkTheme}>
                <ThemedStack />
            </NavigationContainer>,
        );

        await expectText("dark=true highContrast=false");
    });

    it("hands the theme to the screenOptions callback", async () => {
        await render(
            <NavigationContainer theme={DarkTheme}>
                <ThemedStack />
            </NavigationContainer>,
        );

        await screen.findByText("Dark header");
        expect(screen.queryByText("Light header")).toBeNull();
    });

    it("exposes the light and dark theme values", () => {
        expect(DefaultTheme).toEqual({ dark: false, highContrast: false });
        expect(DarkTheme).toEqual({ dark: true, highContrast: false });
    });
});

describe("theme - style manager changes", () => {
    it("re-renders with dark true when the color scheme is forced dark", async () => {
        await render(
            <NavigationContainer>
                <ThemedStack />
            </NavigationContainer>,
        );

        await screen.findByText(describeManager());

        await withColorScheme(Adw.ColorScheme.FORCE_DARK, async () => {
            await screen.findByText("dark=true highContrast=false");
            await screen.findByText("Dark header");
        });

        await expectText(describeManager());
    });

    it("keeps an explicit theme prop when the color scheme changes", async () => {
        await render(
            <NavigationContainer theme={DefaultTheme}>
                <ThemedStack />
            </NavigationContainer>,
        );

        await screen.findByText("dark=false highContrast=false");

        await withColorScheme(Adw.ColorScheme.FORCE_DARK, async () => {
            expect(Adw.StyleManager.getDefault().getDark()).toBe(true);
            await screen.findByText("dark=false highContrast=false");
        });
    });

    it("follows a theme prop change on rerender", async () => {
        const { rerender } = await render(
            <NavigationContainer theme={DarkTheme}>
                <ThemedStack />
            </NavigationContainer>,
        );

        await screen.findByText("dark=true highContrast=false");

        await rerender(
            <NavigationContainer theme={DefaultTheme}>
                <ThemedStack />
            </NavigationContainer>,
        );

        await expectText("dark=false highContrast=false");
    });
});

describe("theme - errors", () => {
    it("throws when useTheme runs outside a container", async () => {
        await expect(render(<Unthemed />)).rejects.toThrow();
    });
});
