import { Overlay } from "@gtkx/components";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkButton, GtkLabel } from "@gtkx/jsx/gtk";
import { render, screen } from "@gtkx/testing";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { countChildren } from "./helpers/child-count.js";

describe("render - Overlay.Child (1)", () => {
    it("adds child as overlay", async () => {
        const overlayRef = createRef<Gtk.Overlay>();
        const mainRef = createRef<Gtk.Label>();

        await render(
            <Overlay ref={overlayRef}>
                <GtkLabel ref={mainRef}>Main Content</GtkLabel>
                <Overlay.Child component={GtkButton} label="Overlay Button" />
            </Overlay>,
        );

        const overlay = overlayRef.current as Gtk.Overlay;
        expect(overlay.getChild()).toBe(mainRef.current);
        expect(screen.getByRole(Gtk.AccessibleRole.BUTTON, { name: "Overlay Button" })).not.toBe(mainRef.current);
        expect(countChildren(overlay)).toBe(2);
    });

    it("sets measure property", async () => {
        const overlayRef = createRef<Gtk.Overlay>();

        await render(
            <Overlay ref={overlayRef}>
                <GtkLabel>Main</GtkLabel>
                <Overlay.Child component={GtkButton} measure={true} label="Measured Overlay" />
            </Overlay>,
        );

        const overlay = overlayRef.current as Gtk.Overlay;
        const button = screen.getByRole(Gtk.AccessibleRole.BUTTON, { name: "Measured Overlay" });
        expect(overlay.getMeasureOverlay(button)).toBe(true);
    });
});

describe("render - Overlay.Child (2)", () => {
    it("sets clipOverlay property", async () => {
        const overlayRef = createRef<Gtk.Overlay>();

        await render(
            <Overlay ref={overlayRef}>
                <GtkLabel>Main</GtkLabel>
                <Overlay.Child component={GtkButton} clipOverlay={true} label="Clipped Overlay" />
            </Overlay>,
        );

        const overlay = overlayRef.current as Gtk.Overlay;
        const button = screen.getByRole(Gtk.AccessibleRole.BUTTON, { name: "Clipped Overlay" });
        expect(overlay.getClipOverlay(button)).toBe(true);
    });
});

describe("render - Overlay.Child (3)", () => {
    it("removes overlay child", async () => {
        const overlayRef = createRef<Gtk.Overlay>();

        function App({ showOverlay }: { showOverlay: boolean }) {
            return (
                <Overlay ref={overlayRef}>
                    <GtkLabel>Main</GtkLabel>
                    {showOverlay && <Overlay.Child component={GtkButton} label="Removable Overlay" />}
                </Overlay>
            );
        }

        await render(<App showOverlay={true} />);
        expect(countChildren(overlayRef.current)).toBe(2);

        await render(<App showOverlay={false} />);
        expect(countChildren(overlayRef.current)).toBe(1);
    });
});

describe("render - Overlay.Child (4)", () => {
    it("adds multiple overlay children with separate wrappers", async () => {
        const overlayRef = createRef<Gtk.Overlay>();

        await render(
            <Overlay ref={overlayRef}>
                <GtkLabel>Main</GtkLabel>
                <Overlay.Child component={GtkButton} label="First Overlay" />
                <Overlay.Child component={GtkButton} label="Second Overlay" />
            </Overlay>,
        );

        expect(countChildren(overlayRef.current)).toBe(3);
    });
});

const renderTwoButtonOverlay = async (measure?: boolean): Promise<Gtk.Overlay> => {
    const overlayRef = createRef<Gtk.Overlay>();

    await render(
        <Overlay ref={overlayRef}>
            <GtkLabel>Main</GtkLabel>
            <Overlay.Child component={GtkButton} measure={measure} label="First" />
            <Overlay.Child component={GtkButton} measure={measure} label="Second" />
        </Overlay>,
    );

    return overlayRef.current as Gtk.Overlay;
};

describe("render - Overlay.Child (5)", () => {
    it("places each overlay under the overlay", async () => {
        const overlay = await renderTwoButtonOverlay();

        expect(countChildren(overlay)).toBe(3);
        const first = screen.getByRole(Gtk.AccessibleRole.BUTTON, { name: "First" });
        const second = screen.getByRole(Gtk.AccessibleRole.BUTTON, { name: "Second" });
        expect(first.getParent()).toBe(overlay);
        expect(second.getParent()).toBe(overlay);
    });
});

describe("render - Overlay.Child (6)", () => {
    it("applies props to each overlay", async () => {
        const overlay = await renderTwoButtonOverlay(true);

        const first = screen.getByRole(Gtk.AccessibleRole.BUTTON, { name: "First" });
        const second = screen.getByRole(Gtk.AccessibleRole.BUTTON, { name: "Second" });
        expect(overlay.getMeasureOverlay(first)).toBe(true);
        expect(overlay.getMeasureOverlay(second)).toBe(true);
    });
});

describe("render - Overlay.Child (7)", () => {
    it("moves the widget to a newly-provided ref when the external ref identity changes", async () => {
        const refA = createRef<Gtk.Button>();
        const refB = createRef<Gtk.Button>();

        function App({ useA }: { useA: boolean }) {
            return (
                <Overlay>
                    <GtkLabel>Main</GtkLabel>
                    <Overlay.Child component={GtkButton} ref={useA ? refA : refB} label="Movable" />
                </Overlay>
            );
        }

        const { rerender } = await render(<App useA={true} />);
        const button = screen.getByRole(Gtk.AccessibleRole.BUTTON, { name: "Movable" });
        expect(refA.current).toBe(button);
        expect(refB.current).toBeNull();

        await rerender(<App useA={false} />);
        expect(refB.current).toBe(button);
        expect(refA.current).toBeNull();
    });
});

describe("render - Overlay.Child (8)", () => {
    it("keeps the overlay attached across rerenders when the child takes an inline ref", async () => {
        const overlayRef = createRef<Gtk.Overlay>();

        function App({ label }: { label: string }) {
            return (
                <Overlay ref={overlayRef}>
                    <GtkLabel>Main</GtkLabel>
                    <Overlay.Child component={GtkButton} ref={() => {}} label={label} />
                </Overlay>
            );
        }

        const { rerender } = await render(<App label="One" />);
        const overlay = overlayRef.current as Gtk.Overlay;
        const button = screen.getByRole(Gtk.AccessibleRole.BUTTON, { name: "One" });
        const removeOverlay = vi.spyOn(overlay, "removeOverlay");
        const addOverlay = vi.spyOn(overlay, "addOverlay");

        await rerender(<App label="Two" />);

        expect(removeOverlay).not.toHaveBeenCalled();
        expect(addOverlay).not.toHaveBeenCalled();
        expect(screen.getByRole(Gtk.AccessibleRole.BUTTON, { name: "Two" })).toBe(button);
        expect(countChildren(overlay)).toBe(2);
    });

    it("runs a callback ref cleanup instead of a null call when the child unmounts", async () => {
        const cleanup = vi.fn();
        const attached: (Gtk.Widget | null)[] = [];

        function App({ visible }: { visible: boolean }) {
            return (
                <Overlay>
                    <GtkLabel>Main</GtkLabel>
                    {visible ? (
                        <Overlay.Child
                            component={GtkButton}
                            label="Disposable"
                            ref={(widget) => {
                                attached.push(widget);
                                return cleanup;
                            }}
                        />
                    ) : null}
                </Overlay>
            );
        }

        const { rerender } = await render(<App visible={true} />);
        expect(attached).toHaveLength(1);
        expect(cleanup).not.toHaveBeenCalled();

        await rerender(<App visible={false} />);
        expect(cleanup).toHaveBeenCalledTimes(1);
        expect(attached).toEqual([attached[0]]);
    });
});
