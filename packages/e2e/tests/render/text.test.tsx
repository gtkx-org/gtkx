import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox } from "@gtkx/react";
import { render } from "@gtkx/testing";
import { createRef } from "react";
import { describe, expect, it } from "vitest";

const getChildLabels = (box: Gtk.Box): string[] => {
    const labels: string[] = [];
    let child = box.getFirstChild();
    while (child) {
        if ("getLabel" in child && typeof child.getLabel === "function") {
            labels.push((child as Gtk.Label).getLabel() ?? "");
        }
        child = child.getNextSibling();
    }
    return labels;
};

describe("render - text instances", () => {
    it("renders string child as Label", async () => {
        const boxRef = createRef<Gtk.Box>();

        await render(
            <GtkBox ref={boxRef} spacing={0} orientation={Gtk.Orientation.VERTICAL}>
                Hello World
            </GtkBox>,
            { wrapper: false },
        );

        const labels = getChildLabels(boxRef.current as Gtk.Box);
        expect(labels).toContain("Hello World");
    });

    it("updates Label text when string changes", async () => {
        const boxRef = createRef<Gtk.Box>();

        function App({ text }: { text: string }) {
            return (
                <GtkBox ref={boxRef} spacing={0} orientation={Gtk.Orientation.VERTICAL}>
                    {text}
                </GtkBox>
            );
        }

        await render(<App text="Initial" />, { wrapper: false });

        expect(getChildLabels(boxRef.current as Gtk.Box)).toContain("Initial");

        await render(<App text="Updated" />, { wrapper: false });

        expect(getChildLabels(boxRef.current as Gtk.Box)).toContain("Updated");
    });

    it("handles empty string", async () => {
        const boxRef = createRef<Gtk.Box>();

        await render(
            <GtkBox ref={boxRef} spacing={0} orientation={Gtk.Orientation.VERTICAL}>
                {""}
            </GtkBox>,
            { wrapper: false },
        );

        const labels = getChildLabels(boxRef.current as Gtk.Box);
        expect(labels).toHaveLength(0);
    });

    it("handles unicode text", async () => {
        const boxRef = createRef<Gtk.Box>();

        await render(
            <GtkBox ref={boxRef} spacing={0} orientation={Gtk.Orientation.VERTICAL}>
                你好世界 🌍 مرحبا
            </GtkBox>,
            { wrapper: false },
        );

        const labels = getChildLabels(boxRef.current as Gtk.Box);
        expect(labels).toContain("你好世界 🌍 مرحبا");
    });

    it("removes text instance when child removed", async () => {
        const boxRef = createRef<Gtk.Box>();

        function App({ showText }: { showText: boolean }) {
            return (
                <GtkBox ref={boxRef} spacing={0} orientation={Gtk.Orientation.VERTICAL}>
                    {showText && "Removable Text"}
                </GtkBox>
            );
        }

        await render(<App showText={true} />, { wrapper: false });

        expect(getChildLabels(boxRef.current as Gtk.Box)).toContain("Removable Text");

        await render(<App showText={false} />, { wrapper: false });

        expect(getChildLabels(boxRef.current as Gtk.Box)).not.toContain("Removable Text");
    });

    it("handles multiple text children", async () => {
        const boxRef = createRef<Gtk.Box>();

        await render(
            <GtkBox ref={boxRef} spacing={0} orientation={Gtk.Orientation.VERTICAL}>
                {"First"}
                {"Second"}
                {"Third"}
            </GtkBox>,
            { wrapper: false },
        );

        const labels = getChildLabels(boxRef.current as Gtk.Box);
        expect(labels).toContain("First");
        expect(labels).toContain("Second");
        expect(labels).toContain("Third");
    });
});
