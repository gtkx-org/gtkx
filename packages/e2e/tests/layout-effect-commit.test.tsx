import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkButton, GtkLabel } from "@gtkx/jsx/gtk";
import { createRoot, type RootElement, rootElement } from "@gtkx/react";
import { act, render, screen, userEvent } from "@gtkx/testing";
import { createRef, useLayoutEffect, useState } from "react";
import { describe, expect, it, vi } from "vitest";

const adjustCommittedLabel = (label: Gtk.Label | null): void => {
    if (!label) {
        throw new Error("expected the committed label ref");
    }

    label.setLabel(`${label.getLabel()}-adjusted`);
};

describe("layout effects during commit (1)", () => {
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

        expect(await screen.findByText("committed-adjusted")).toBeDefined();
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

describe("layout effects during commit (2)", () => {
    it("keeps one root's signals flowing while another root is inside its commit window", async () => {
        const containerA: RootElement = { ...rootElement };
        const containerB: RootElement = { ...rootElement };
        const rootA = createRoot(containerA);
        const rootB = createRoot(containerB);
        const buttonB = createRef<Gtk.Button>();
        const onClickedB = vi.fn();

        await act(() => {
            rootB.render(<GtkButton ref={buttonB} label="b" onClicked={onClickedB} />);
        });

        const CrossRootEmitter = () => {
            useLayoutEffect(() => {
                buttonB.current?.emit("clicked");
            }, []);

            return <GtkLabel>a</GtkLabel>;
        };

        await act(() => {
            rootA.render(<CrossRootEmitter />);
        });

        expect(onClickedB).toHaveBeenCalledTimes(1);

        await act(() => {
            rootA.unmount();
            rootB.unmount();
        });
    });
});
