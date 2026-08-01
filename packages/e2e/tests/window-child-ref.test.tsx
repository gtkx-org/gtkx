import type * as Gtk from "@gtkx/gi/gtk";
import * as Gio from "@gtkx/gi/gio";
import { GtkApplication, GtkApplicationWindow, GtkBox, GtkLabel } from "@gtkx/jsx/gtk";
import { rootElement } from "@gtkx/react";
import { render } from "@gtkx/testing";
import { type RefObject, useEffect, useRef } from "react";
import { describe, expect, it } from "vitest";
import { createAppIdFactory } from "./helpers/unique-name.js";

type Captured = { label: Gtk.Label | null; calls: number };

const uniqueAppId = createAppIdFactory("org.gtkx.windowchildref");

const renderHost = async (captured: Captured, body?: (ref: RefObject<Gtk.Label | null>) => void): Promise<void> => {
    const Host = () => {
        const labelRef = useRef<Gtk.Label | null>(null);

        useEffect(() => {
            captured.calls += 1;
            captured.label = labelRef.current;
            body?.(labelRef);
        }, []);

        return (
            <GtkApplicationWindow defaultWidth={100} defaultHeight={100}>
                <GtkBox>
                    <GtkLabel ref={labelRef}>hello</GtkLabel>
                </GtkBox>
            </GtkApplicationWindow>
        );
    };

    await render(
        <GtkApplication applicationId={uniqueAppId()} flags={Gio.ApplicationFlags.NON_UNIQUE}>
            <Host />
        </GtkApplication>,
        { container: rootElement },
    );
};

describe("a component that renders a window", () => {
    it("sees a descendant ref populated in its mount effect", async () => {
        const captured: Captured = { label: null, calls: 0 };
        await renderHost(captured);
        expect(captured.calls).toBe(1);
        expect(captured.label).not.toBeNull();
    });

    it("can drive the descendant from that effect, as the browser example does", async () => {
        const captured: Captured = { label: null, calls: 0 };

        await renderHost(captured, (labelRef) => {
            labelRef.current?.setLabel("driven");
        });

        expect(captured.label?.getLabel()).toBe("driven");
    });
});
