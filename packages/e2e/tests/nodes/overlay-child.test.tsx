import { Overlay } from "@gtkx/components";
import type * as Gtk from "@gtkx/gi/gtk";
import { GtkButton, GtkLabel } from "@gtkx/jsx/gtk";
import { render } from "@gtkx/testing";
import { createRef } from "react";
import { describe, expect, it } from "vitest";
import { countChildren } from "../helpers/child-count.js";

describe("render - Overlay.Child (1)", () => {
    it("adds child as overlay", async () => {
        const overlayRef = createRef<Gtk.Overlay>();
        const mainRef = createRef<Gtk.Label>();

        await render(
            <Overlay ref={overlayRef}>
                <GtkLabel ref={mainRef} label="Main Content" />
                <Overlay.Child>{(ref) => <GtkButton ref={ref} label="Overlay Button" />}</Overlay.Child>
            </Overlay>,
        );

        const overlay = overlayRef.current as Gtk.Overlay;
        expect(overlay.getChild()).toBe(mainRef.current);
        expect(overlay.getLastChild()).not.toBe(mainRef.current);
        expect(countChildren(overlay)).toBe(2);
    });

    it("sets measure property", async () => {
        const overlayRef = createRef<Gtk.Overlay>();

        await render(
            <Overlay ref={overlayRef}>
                <GtkLabel label="Main" />
                <Overlay.Child measure={true}>
                    {(ref) => <GtkButton ref={ref} label="Measured Overlay" />}
                </Overlay.Child>
            </Overlay>,
        );

        const overlay = overlayRef.current as Gtk.Overlay;
        expect(overlay.getMeasureOverlay(overlay.getLastChild() as Gtk.Widget)).toBe(true);
    });
});

describe("render - Overlay.Child (2)", () => {
    it("sets clipOverlay property", async () => {
        const overlayRef = createRef<Gtk.Overlay>();

        await render(
            <Overlay ref={overlayRef}>
                <GtkLabel label="Main" />
                <Overlay.Child clipOverlay={true}>
                    {(ref) => <GtkButton ref={ref} label="Clipped Overlay" />}
                </Overlay.Child>
            </Overlay>,
        );

        const overlay = overlayRef.current as Gtk.Overlay;
        expect(overlay.getClipOverlay(overlay.getLastChild() as Gtk.Widget)).toBe(true);
    });
});

describe("render - Overlay.Child (3)", () => {
    it("removes overlay child", async () => {
        const overlayRef = createRef<Gtk.Overlay>();

        function App({ showOverlay }: { showOverlay: boolean }) {
            return (
                <Overlay ref={overlayRef}>
                    <GtkLabel label="Main" />
                    {showOverlay && (
                        <Overlay.Child>{(ref) => <GtkButton ref={ref} label="Removable Overlay" />}</Overlay.Child>
                    )}
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
                <GtkLabel label="Main" />
                <Overlay.Child>{(ref) => <GtkButton ref={ref} label="First Overlay" />}</Overlay.Child>
                <Overlay.Child>{(ref) => <GtkButton ref={ref} label="Second Overlay" />}</Overlay.Child>
            </Overlay>,
        );

        expect(countChildren(overlayRef.current)).toBe(3);
    });
});

const renderTwoButtonOverlay = async (measure?: boolean): Promise<Gtk.Overlay> => {
    const overlayRef = createRef<Gtk.Overlay>();

    await render(
        <Overlay ref={overlayRef}>
            <GtkLabel label="Main" />
            <Overlay.Child measure={measure}>{(ref) => <GtkButton ref={ref} label="First" />}</Overlay.Child>
            <Overlay.Child measure={measure}>{(ref) => <GtkButton ref={ref} label="Second" />}</Overlay.Child>
        </Overlay>,
    );

    return overlayRef.current as Gtk.Overlay;
};

describe("render - Overlay.Child (5)", () => {
    it("places each overlay under the overlay", async () => {
        const overlay = await renderTwoButtonOverlay();

        expect(countChildren(overlay)).toBe(3);
        const second = overlay.getLastChild() as Gtk.Widget;
        const first = second.getPrevSibling() as Gtk.Widget;
        expect(first.getParent()).toBe(overlay);
        expect(second.getParent()).toBe(overlay);
    });
});

describe("render - Overlay.Child (6)", () => {
    it("applies props to each overlay", async () => {
        const overlay = await renderTwoButtonOverlay(true);

        const second = overlay.getLastChild() as Gtk.Widget;
        const first = second.getPrevSibling() as Gtk.Widget;
        expect(overlay.getMeasureOverlay(first)).toBe(true);
        expect(overlay.getMeasureOverlay(second)).toBe(true);
    });
});
