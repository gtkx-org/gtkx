import type * as WebKit from "@gtkx/gi/webkit";
import type { ReactNode } from "react";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkButton, GtkLabel } from "@gtkx/jsx/gtk";
import { WebKitSettings } from "@gtkx/jsx/webkit";
import { createPortal, rootElement, useProperty } from "@gtkx/react";
import { render, screen, userEvent } from "@gtkx/testing";
import { useState } from "react";
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
