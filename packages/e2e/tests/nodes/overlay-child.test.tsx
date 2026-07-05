import { Overlay } from "@gtkx/components";
import type * as Gtk from "@gtkx/gi/gtk";
import { GtkButton, GtkLabel } from "@gtkx/jsx/gtk";
import { render } from "@gtkx/testing";
import { createRef, type RefObject } from "react";
import { describe, expect, it } from "vitest";
import { countChildren } from "../helpers/child-count.js";

describe("render - OverlayChild > OverlayChildNode (1)", () => {
    it("adds child as overlay", async () => {
        const overlayRef = createRef<Gtk.Overlay>();
        const mainRef = createRef<Gtk.Label>();
        const overlayChildRef = createRef<Gtk.Button>();

        await render(
            <Overlay ref={overlayRef}>
                <GtkLabel ref={mainRef} label="Main Content" />
                <Overlay.Child>
                    <GtkButton ref={overlayChildRef} label="Overlay Button" />
                </Overlay.Child>
            </Overlay>,
        );

        const child = overlayRef.current?.getChild();
        const parent = overlayChildRef.current?.getParent();
        expect(child && mainRef.current && child === mainRef.current).toBe(true);
        expect(parent && overlayRef.current && parent === overlayRef.current).toBe(true);
    });

    it("sets measure property", async () => {
        const overlayRef = createRef<Gtk.Overlay>();
        const buttonRef = createRef<Gtk.Button>();

        await render(
            <Overlay ref={overlayRef}>
                <GtkLabel label="Main" />
                <Overlay.Child measure={true}>
                    <GtkButton ref={buttonRef} label="Measured Overlay" />
                </Overlay.Child>
            </Overlay>,
        );

        const isMeasured = overlayRef.current?.getMeasureOverlay(buttonRef.current as Gtk.Widget);
        expect(isMeasured).toBe(true);
    });
});

describe("render - OverlayChild > OverlayChildNode (2)", () => {
    it("sets clipOverlay property", async () => {
        const overlayRef = createRef<Gtk.Overlay>();
        const buttonRef = createRef<Gtk.Button>();

        await render(
            <Overlay ref={overlayRef}>
                <GtkLabel label="Main" />
                <Overlay.Child clipOverlay={true}>
                    <GtkButton ref={buttonRef} label="Clipped Overlay" />
                </Overlay.Child>
            </Overlay>,
        );

        const isClipped = overlayRef.current?.getClipOverlay(buttonRef.current as Gtk.Widget);
        expect(isClipped).toBe(true);
    });
});

describe("render - OverlayChild > OverlayChildNode (3)", () => {
    it("removes overlay child", async () => {
        const overlayRef = createRef<Gtk.Overlay>();

        function App({ showOverlay }: { showOverlay: boolean }) {
            return (
                <Overlay ref={overlayRef}>
                    <GtkLabel label="Main" />
                    {showOverlay && (
                        <Overlay.Child>
                            <GtkButton label="Removable Overlay" />
                        </Overlay.Child>
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

describe("render - OverlayChild > OverlayChildNode (4)", () => {
    it("adds multiple overlay children with separate wrappers", async () => {
        const overlayRef = createRef<Gtk.Overlay>();

        await render(
            <Overlay ref={overlayRef}>
                <GtkLabel label="Main" />
                <Overlay.Child>
                    <GtkButton label="First Overlay" />
                </Overlay.Child>
                <Overlay.Child>
                    <GtkButton label="Second Overlay" />
                </Overlay.Child>
            </Overlay>,
        );

        expect(countChildren(overlayRef.current)).toBe(3);
    });
});

type TwoButtonOverlayRefs = {
    overlayRef: RefObject<Gtk.Overlay | null>;
    firstRef: RefObject<Gtk.Button | null>;
    secondRef: RefObject<Gtk.Button | null>;
};

const renderTwoButtonOverlay = async (measure?: boolean): Promise<TwoButtonOverlayRefs> => {
    const overlayRef = createRef<Gtk.Overlay>();
    const firstRef = createRef<Gtk.Button>();
    const secondRef = createRef<Gtk.Button>();

    await render(
        <Overlay ref={overlayRef}>
            <GtkLabel label="Main" />
            <Overlay.Child measure={measure}>
                <GtkButton ref={firstRef} label="First" />
                <GtkButton ref={secondRef} label="Second" />
            </Overlay.Child>
        </Overlay>,
    );

    return { overlayRef, firstRef, secondRef };
};

describe("render - OverlayChild > OverlayChildNode (5)", () => {
    it("adds multiple children in single wrapper", async () => {
        const { overlayRef, firstRef, secondRef } = await renderTwoButtonOverlay();

        expect(countChildren(overlayRef.current)).toBe(3);

        const firstParent = firstRef.current?.getParent();
        const secondParent = secondRef.current?.getParent();
        expect(firstParent && overlayRef.current && firstParent === overlayRef.current).toBe(true);
        expect(secondParent && overlayRef.current && secondParent === overlayRef.current).toBe(true);
    });
});

describe("render - OverlayChild > OverlayChildNode (6)", () => {
    it("applies props to all children in wrapper", async () => {
        const { overlayRef, firstRef, secondRef } = await renderTwoButtonOverlay(true);

        const firstMeasured = overlayRef.current?.getMeasureOverlay(firstRef.current as Gtk.Widget);
        const secondMeasured = overlayRef.current?.getMeasureOverlay(secondRef.current as Gtk.Widget);
        expect(firstMeasured).toBe(true);
        expect(secondMeasured).toBe(true);
    });
});
