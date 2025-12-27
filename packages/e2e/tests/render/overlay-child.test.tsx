import type * as Gtk from "@gtkx/ffi/gtk";
import { GtkButton, GtkLabel, GtkOverlay, OverlayChild } from "@gtkx/react";
import { render } from "@gtkx/testing";
import { createRef } from "react";
import { describe, expect, it } from "vitest";

describe("render - OverlayChild", () => {
    describe("OverlayChildNode", () => {
        it("adds child as overlay", async () => {
            const overlayRef = createRef<Gtk.Overlay>();
            const mainRef = createRef<Gtk.Label>();
            const overlayChildRef = createRef<Gtk.Button>();

            await render(
                <GtkOverlay ref={overlayRef}>
                    <GtkLabel ref={mainRef} label="Main Content" />
                    <OverlayChild>
                        <GtkButton ref={overlayChildRef} label="Overlay Button" />
                    </OverlayChild>
                </GtkOverlay>,
                { wrapper: false },
            );

            expect(overlayRef.current?.getChild()?.equals(mainRef.current)).toBe(true);
            expect(overlayChildRef.current?.getParent()?.equals(overlayRef.current)).toBe(true);
        });

        it("sets measure property", async () => {
            const overlayRef = createRef<Gtk.Overlay>();
            const buttonRef = createRef<Gtk.Button>();

            await render(
                <GtkOverlay ref={overlayRef}>
                    Main
                    <OverlayChild measure={true}>
                        <GtkButton ref={buttonRef} label="Measured Overlay" />
                    </OverlayChild>
                </GtkOverlay>,
                { wrapper: false },
            );

            const isMeasured = overlayRef.current?.getMeasureOverlay(buttonRef.current as Gtk.Widget);
            expect(isMeasured).toBe(true);
        });

        it("sets clipOverlay property", async () => {
            const overlayRef = createRef<Gtk.Overlay>();
            const buttonRef = createRef<Gtk.Button>();

            await render(
                <GtkOverlay ref={overlayRef}>
                    Main
                    <OverlayChild clipOverlay={true}>
                        <GtkButton ref={buttonRef} label="Clipped Overlay" />
                    </OverlayChild>
                </GtkOverlay>,
                { wrapper: false },
            );

            const isClipped = overlayRef.current?.getClipOverlay(buttonRef.current as Gtk.Widget);
            expect(isClipped).toBe(true);
        });

        it("removes overlay child", async () => {
            const overlayRef = createRef<Gtk.Overlay>();

            function App({ showOverlay }: { showOverlay: boolean }) {
                return (
                    <GtkOverlay ref={overlayRef}>
                        Main
                        {showOverlay && (
                            <OverlayChild>
                                <GtkButton label="Removable Overlay" />
                            </OverlayChild>
                        )}
                    </GtkOverlay>
                );
            }

            await render(<App showOverlay={true} />, { wrapper: false });

            let childCount = 0;
            let child = overlayRef.current?.getFirstChild();
            while (child) {
                childCount++;
                child = child.getNextSibling();
            }
            expect(childCount).toBe(2);

            await render(<App showOverlay={false} />, { wrapper: false });

            childCount = 0;
            child = overlayRef.current?.getFirstChild();
            while (child) {
                childCount++;
                child = child.getNextSibling();
            }
            expect(childCount).toBe(1);
        });

        it("adds multiple overlay children", async () => {
            const overlayRef = createRef<Gtk.Overlay>();

            await render(
                <GtkOverlay ref={overlayRef}>
                    Main
                    <OverlayChild>
                        <GtkButton label="First Overlay" />
                    </OverlayChild>
                    <OverlayChild>
                        <GtkButton label="Second Overlay" />
                    </OverlayChild>
                </GtkOverlay>,
                { wrapper: false },
            );

            let childCount = 0;
            let child = overlayRef.current?.getFirstChild();
            while (child) {
                childCount++;
                child = child.getNextSibling();
            }
            expect(childCount).toBe(3);
        });
    });
});
