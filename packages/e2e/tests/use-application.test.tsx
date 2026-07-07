import * as Gio from "@gtkx/gi/gio";
import { GtkApplication, GtkApplicationWindow } from "@gtkx/jsx/gtk";
import { createRootElement, useApplication } from "@gtkx/react";
import { render } from "@gtkx/testing";
import { describe, expect, it } from "vitest";

let nextAppId = 0;
const uniqueAppId = (): string => `org.gtkx.useapplicationtest${nextAppId++}`;

describe("useApplication", () => {
    it("returns the GTK application provided by ApplicationContext", async () => {
        let captured: unknown = "unset";

        const Probe = () => {
            captured = useApplication();
            return <GtkApplicationWindow defaultWidth={100} defaultHeight={100} />;
        };

        await render(
            <GtkApplication applicationId={uniqueAppId()} flags={Gio.ApplicationFlags.NON_UNIQUE}>
                <Probe />
            </GtkApplication>,
            { container: createRootElement() },
        );

        expect(captured).not.toBeNull();
        expect(typeof (captured as { register?: unknown }).register).toBe("function");
    });

    it("throws when the ApplicationContext value is null", async () => {
        const Probe = () => {
            useApplication();
            return null;
        };

        await expect(render(<Probe />, { container: createRootElement() })).rejects.toThrow(
            /useApplication must be called within Application/,
        );
    });
});
