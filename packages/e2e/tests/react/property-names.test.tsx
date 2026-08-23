import type { ReactNode } from "react";
import * as WebKit from "@gtkx/gi/webkit";
import { GtkLabel } from "@gtkx/jsx/gtk";
import { useProperty } from "@gtkx/react";
import { act, render, screen } from "@gtkx/testing";
import { describe, expect, it } from "vitest";

const Probe = ({ settings }: { settings: WebKit.Settings }): ReactNode => {
    const enabled = useProperty(settings, "enable2dCanvasAcceleration");

    return <GtkLabel label={`accel ${String(enabled)}`} />;
};

describe("property names (digit segments)", () => {
    it("follows a property whose name kebab-casing cannot reconstruct", async () => {
        const settings = new WebKit.Settings({});
        await render(<Probe settings={settings} />);
        await screen.findByText("accel true");

        await act(() => {
            settings.setEnable2dCanvasAcceleration(false);
        });

        expect(await screen.findByText("accel false")).toBeVisible();
    });
});
