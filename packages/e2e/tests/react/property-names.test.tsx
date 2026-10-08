import type { ReactNode } from "react";
import * as Gtk from "@gtkx/gi/gtk";
import * as WebKit from "@gtkx/gi/webkit";
import { GtkBox, GtkButton, GtkLabel } from "@gtkx/jsx/gtk";
import { WebKitSettings, WebKitWebView } from "@gtkx/jsx/webkit";
import { createPortal, rootElement, useProperty } from "@gtkx/react";
import { act, render, screen, userEvent, waitFor } from "@gtkx/testing";
import { createRef, useState } from "react";
import { describe, expect, it } from "vitest";

const Probe = (): ReactNode => {
    const [settings, setSettings] = useState<WebKit.Settings | null>(null);
    const enabled = useProperty(settings, "enable2dCanvasAcceleration");

    return (
        <GtkBox>
            {createPortal(<WebKitSettings ref={setSettings} />, rootElement)}
            <GtkLabel label={`accel ${String(enabled)}`} />
            <GtkButton
                label="Disable acceleration"
                onClicked={() => {
                    settings?.setEnable2dCanvasAcceleration(false);
                }}
            />
        </GtkBox>
    );
};

describe("property names (digit segments)", () => {
    it("follows a property whose name kebab-casing cannot reconstruct", async () => {
        await render(<Probe />);
        await screen.findByText("accel true");
        await userEvent.click(screen.getByRole(Gtk.AccessibleRole.BUTTON, { name: "Disable acceleration" }));
        expect(await screen.findByText("accel false")).toBeVisible();
    });
});

describe("property notify values", () => {
    it("reads loading notifications whose camelCase accessor collides with a method in Strict Mode", async () => {
        const webViewRef = createRef<WebKit.WebView>();
        const values: (boolean | null)[] = [];

        await render(
            <WebKitWebView
                ref={webViewRef}
                onNotifyIsLoading={(value) => {
                    values.push(value);
                }}
            />,
            { isReactStrictMode: true },
        );

        await act(() => {
            webViewRef.current?.loadUri("data:text/html,<title>Loaded</title>");
        });

        await waitFor(() => {
            expect(values).toContain(true);
            expect(values.at(-1)).toBe(false);
            expect(webViewRef.current?.getTitle()).toBe("Loaded");
        });
    });
});
