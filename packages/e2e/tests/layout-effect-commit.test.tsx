import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkButton, GtkLabel } from "@gtkx/jsx/gtk";
import { render, screen, userEvent } from "@gtkx/testing";
import { createRef, useLayoutEffect, useState } from "react";
import { describe, expect, it, vi } from "vitest";

describe("layout effects during commit", () => {
    it("reads and writes a widget imperatively from a layout effect", async () => {
        const labelRef = createRef<Gtk.Label>();

        const Probe = () => {
            useLayoutEffect(() => {
                const label = labelRef.current;
                if (!label) throw new Error("expected the committed label ref");
                label.setLabel(`${label.getLabel()}-adjusted`);
            }, []);
            return <GtkLabel ref={labelRef} label="committed" />;
        };

        await render(
            <GtkBox orientation={Gtk.Orientation.VERTICAL}>
                <Probe />
            </GtkBox>,
        );

        expect(labelRef.current?.getLabel()).toBe("committed-adjusted");
    });

    it("keeps signals flowing after a layout effect spawns a synchronous re-render", async () => {
        const onClicked = vi.fn();

        const Trigger = () => {
            const [armed, setArmed] = useState(false);
            useLayoutEffect(() => {
                setArmed(true);
            }, []);
            return <GtkButton label={armed ? "armed" : "idle"} onClicked={onClicked} />;
        };

        await render(<Trigger />);
        await userEvent.click(await screen.findByText("armed"));

        expect(onClicked).toHaveBeenCalledTimes(1);
    });
});
