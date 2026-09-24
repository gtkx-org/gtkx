import type { RootElement } from "@gtkx/react";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkButton, GtkCheckButton, GtkLabel } from "@gtkx/jsx/gtk";
import { createRoot, rootElement } from "@gtkx/react";
import { act, render, screen, userEvent } from "@gtkx/testing";
import { createRef, useLayoutEffect, useState } from "react";
import { describe, expect, it } from "vitest";

const adjustCommittedLabel = (label: Gtk.Label | null): void => {
    if (!label) {
        throw new Error("expected the committed label ref");
    }

    label.setLabel(`${label.getLabel()}-adjusted`);
};

describe("layout effects during commit", () => {
    it("reads and writes a widget imperatively from a layout effect", async () => {
        const labelRef = createRef<Gtk.Label>();

        const Probe = () => {
            useLayoutEffect(() => {
                adjustCommittedLabel(labelRef.current);
            }, []);

            return <GtkLabel ref={labelRef}>committed</GtkLabel>;
        };

        await render(
            <GtkBox orientation={Gtk.Orientation.VERTICAL}>
                <Probe />
            </GtkBox>,
        );

        expect(await screen.findByText("committed-adjusted")).toBeRooted();
    });

    it("keeps signals flowing after a layout effect spawns a synchronous re-render", async () => {
        let clickCount = 0;
        const onClicked = (): void => {
            clickCount += 1;
        };

        const Trigger = () => {
            const [armed, setArmed] = useState(false);

            useLayoutEffect(() => {
                setArmed(true);
            }, []);

            return <GtkButton label={armed ? "armed" : "idle"} onClicked={onClicked} />;
        };

        await render(<Trigger />);
        await userEvent.click(await screen.findByText("armed"));
        expect(clickCount).toBe(1);
    });

    it("keeps one root's signals flowing while another root is inside its commit window", async () => {
        const containerA: RootElement = { ...rootElement };
        const containerB: RootElement = { ...rootElement };
        const rootA = createRoot(containerA);
        const rootB = createRoot(containerB);
        const checkB = createRef<Gtk.CheckButton>();
        let toggledCount = 0;
        const onToggledB = (): void => {
            toggledCount += 1;
        };

        const CrossRootEmitter = () => {
            useLayoutEffect(() => {
                checkB.current?.emit("toggled");
            }, []);

            return <GtkLabel>a</GtkLabel>;
        };

        try {
            await act(() => {
                rootB.render(<GtkCheckButton ref={checkB} label="b" onToggled={onToggledB} />);
            });

            toggledCount = 0;

            await act(() => {
                rootA.render(<CrossRootEmitter />);
            });

            expect(toggledCount).toBe(1);
        } finally {
            await act(() => {
                rootA.unmount();
                rootB.unmount();
            });
        }
    });
});
