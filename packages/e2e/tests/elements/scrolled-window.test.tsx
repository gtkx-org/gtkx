import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkLabel, GtkScrolledWindow } from "@gtkx/jsx/gtk";
import { render, screen } from "@gtkx/testing";
import { createRef } from "react";
import { describe, expect, it } from "vitest";

const getPolicy = (scrolledWindow: Gtk.ScrolledWindow): [Gtk.PolicyType, Gtk.PolicyType] => {
    return scrolledWindow.getPolicy();
};

function App({ text }: { text: string }) {
    return (
        <GtkScrolledWindow>
            <GtkLabel>{text}</GtkLabel>
        </GtkScrolledWindow>
    );
}

describe("render - ScrolledWindow (1)", () => {
    it("creates ScrolledWindow widget", async () => {
        const ref = createRef<Gtk.ScrolledWindow>();

        await render(
            <GtkScrolledWindow ref={ref}>
                <GtkLabel>Content</GtkLabel>
            </GtkScrolledWindow>,
        );

        expect(ref.current).not.toBeNull();
        expect(ref.current).toBeInstanceOf(Gtk.ScrolledWindow);
    });

    it("sets AUTOMATIC scroll policy by default", async () => {
        const ref = createRef<Gtk.ScrolledWindow>();

        await render(
            <GtkScrolledWindow ref={ref}>
                <GtkLabel>Content</GtkLabel>
            </GtkScrolledWindow>,
        );

        const [hPolicy, vPolicy] = getPolicy(ref.current as Gtk.ScrolledWindow);
        expect(hPolicy).toBe(Gtk.PolicyType.AUTOMATIC);
        expect(vPolicy).toBe(Gtk.PolicyType.AUTOMATIC);
    });

    it("sets horizontal scroll policy", async () => {
        const ref = createRef<Gtk.ScrolledWindow>();

        await render(
            <GtkScrolledWindow ref={ref} hscrollbarPolicy={Gtk.PolicyType.NEVER}>
                <GtkLabel>Content</GtkLabel>
            </GtkScrolledWindow>,
        );

        const [hPolicy] = getPolicy(ref.current as Gtk.ScrolledWindow);
        expect(hPolicy).toBe(Gtk.PolicyType.NEVER);
    });
});

describe("render - ScrolledWindow (2)", () => {
    it("sets vertical scroll policy", async () => {
        const ref = createRef<Gtk.ScrolledWindow>();

        await render(
            <GtkScrolledWindow ref={ref} vscrollbarPolicy={Gtk.PolicyType.ALWAYS}>
                <GtkLabel>Content</GtkLabel>
            </GtkScrolledWindow>,
        );

        const [, vPolicy] = getPolicy(ref.current as Gtk.ScrolledWindow);
        expect(vPolicy).toBe(Gtk.PolicyType.ALWAYS);
    });

    it("sets both scroll policies", async () => {
        const ref = createRef<Gtk.ScrolledWindow>();

        await render(
            <GtkScrolledWindow
                ref={ref}
                hscrollbarPolicy={Gtk.PolicyType.NEVER}
                vscrollbarPolicy={Gtk.PolicyType.ALWAYS}
            >
                <GtkLabel>Content</GtkLabel>
            </GtkScrolledWindow>,
        );

        const [hPolicy, vPolicy] = getPolicy(ref.current as Gtk.ScrolledWindow);
        expect(hPolicy).toBe(Gtk.PolicyType.NEVER);
        expect(vPolicy).toBe(Gtk.PolicyType.ALWAYS);
    });
});

describe("render - ScrolledWindow (3)", () => {
    it("updates scroll policy when props change", async () => {
        const ref = createRef<Gtk.ScrolledWindow>();

        function App({ hPolicyProp, vPolicyProp }: { hPolicyProp: Gtk.PolicyType; vPolicyProp: Gtk.PolicyType }) {
            return (
                <GtkScrolledWindow ref={ref} hscrollbarPolicy={hPolicyProp} vscrollbarPolicy={vPolicyProp}>
                    <GtkLabel>Content</GtkLabel>
                </GtkScrolledWindow>
            );
        }

        await render(<App hPolicyProp={Gtk.PolicyType.AUTOMATIC} vPolicyProp={Gtk.PolicyType.AUTOMATIC} />);
        let [hPolicy, vPolicy] = getPolicy(ref.current as Gtk.ScrolledWindow);
        expect(hPolicy).toBe(Gtk.PolicyType.AUTOMATIC);
        expect(vPolicy).toBe(Gtk.PolicyType.AUTOMATIC);
        await render(<App hPolicyProp={Gtk.PolicyType.NEVER} vPolicyProp={Gtk.PolicyType.ALWAYS} />);
        [hPolicy, vPolicy] = getPolicy(ref.current as Gtk.ScrolledWindow);
        expect(hPolicy).toBe(Gtk.PolicyType.NEVER);
        expect(vPolicy).toBe(Gtk.PolicyType.ALWAYS);
    });

    it("contains child widget", async () => {
        await render(
            <GtkScrolledWindow>
                <GtkLabel>Scrollable Content</GtkLabel>
            </GtkScrolledWindow>,
        );

        expect(screen.getByText("Scrollable Content")).toBeDefined();
    });
});

describe("render - ScrolledWindow (4)", () => {
    it("works with Box as child", async () => {
        await render(
            <GtkScrolledWindow>
                <GtkBox orientation={Gtk.Orientation.VERTICAL}>
                    <GtkLabel>Item 1</GtkLabel>
                    <GtkLabel>Item 2</GtkLabel>
                    <GtkLabel>Item 3</GtkLabel>
                </GtkBox>
            </GtkScrolledWindow>,
        );

        expect(screen.getByText("Item 1")).toBeDefined();
    });

    it("updates child when changed", async () => {
        await render(<App text="Initial" />);
        expect(screen.getByText("Initial")).toBeDefined();
        await render(<App text="Updated" />);
        expect(screen.getByText("Updated")).toBeDefined();
    });
});
