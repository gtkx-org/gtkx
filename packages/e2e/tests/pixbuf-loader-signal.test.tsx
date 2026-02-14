import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as Gdk from "@gtkx/ffi/gdk";
import * as GdkPixbuf from "@gtkx/ffi/gdkpixbuf";
import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkPicture, GtkWindow } from "@gtkx/react";
import { render, tick, waitFor } from "@gtkx/testing";
import type React from "react";
import { createRef, useEffect, useLayoutEffect, useState } from "react";
import { describe, expect, it } from "vitest";

const alphatestPngPath = resolve(import.meta.dirname, "../../../examples/gtk-demo/src/demos/drawing/alphatest.png");

describe("PixbufLoader signals", () => {
    it("area-prepared fires after writing all data and closing", async () => {
        let areaPreparedFired = false;

        const TestComponent = () => {
            useEffect(() => {
                const loader = new GdkPixbuf.PixbufLoader();
                loader.connect("area-prepared", () => {
                    areaPreparedFired = true;
                });
                const data = readFileSync(alphatestPngPath);
                loader.write([...data], data.length);
                loader.close();
            }, []);
            return <GtkBox />;
        };

        await render(<TestComponent />);
        await tick();
        expect(areaPreparedFired).toBe(true);
    });

    it("creates valid texture from pixbuf in area-prepared callback", async () => {
        let texture: Gdk.Texture | null = null;

        const TestComponent = () => {
            useEffect(() => {
                const loader = new GdkPixbuf.PixbufLoader();
                loader.connect("area-prepared", () => {
                    const pixbuf = loader.getPixbuf();
                    if (pixbuf) {
                        pixbuf.fill(0xaaaaaaff);
                        texture = new Gdk.Texture(pixbuf);
                    }
                });
                const data = readFileSync(alphatestPngPath);
                loader.write([...data], data.length);
                loader.close();
            }, []);
            return <GtkBox />;
        };

        await render(<TestComponent />);
        await tick();
        expect(texture).not.toBeNull();
    });

    it("WidgetPaintable works with useEffect on parent ref", async () => {
        const effectRef = createRef<Gtk.Picture>();
        const layoutRef = createRef<Gtk.Picture>();

        const EffectInner = ({ windowRef }: { windowRef: React.RefObject<Gtk.Window | null> }) => {
            const [paintable, setPaintable] = useState<Gtk.WidgetPaintable | null>(null);
            useEffect(() => {
                const win = windowRef.current;
                if (win) setPaintable(new Gtk.WidgetPaintable(win));
            }, [windowRef]);
            return (
                <GtkPicture ref={effectRef} paintable={paintable} widthRequest={100} heightRequest={100} canShrink />
            );
        };

        const LayoutInner = ({ windowRef }: { windowRef: React.RefObject<Gtk.Window | null> }) => {
            const [paintable, setPaintable] = useState<Gtk.WidgetPaintable | null>(null);
            useLayoutEffect(() => {
                const win = windowRef.current;
                if (win) setPaintable(new Gtk.WidgetPaintable(win));
            }, [windowRef]);
            return (
                <GtkPicture ref={layoutRef} paintable={paintable} widthRequest={100} heightRequest={100} canShrink />
            );
        };

        const windowRef1 = createRef<Gtk.Window>();
        const windowRef2 = createRef<Gtk.Window>();

        await render(
            <GtkBox>
                <GtkWindow ref={windowRef1} defaultWidth={200} defaultHeight={200}>
                    <EffectInner windowRef={windowRef1} />
                </GtkWindow>
                <GtkWindow ref={windowRef2} defaultWidth={200} defaultHeight={200}>
                    <LayoutInner windowRef={windowRef2} />
                </GtkWindow>
            </GtkBox>,
        );

        await waitFor(
            () => {
                expect(effectRef.current?.getPaintable()).not.toBeNull();
            },
            { timeout: 3000 },
        );

        expect(layoutRef.current?.getPaintable()).toBeNull();
    });
});
