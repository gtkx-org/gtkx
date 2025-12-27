import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkLabel, GtkSwitch } from "@gtkx/react";
import { render } from "@gtkx/testing";
import { createRef } from "react";
import { describe, expect, it } from "vitest";

describe("render - props", () => {
    describe("property setting", () => {
        it("sets string properties", async () => {
            const ref = createRef<Gtk.Label>();

            await render(<GtkLabel ref={ref} label="Test Label" />, { wrapper: false });

            expect(ref.current?.getLabel()).toBe("Test Label");
        });

        it("sets boolean properties", async () => {
            const ref = createRef<Gtk.Label>();

            await render(<GtkLabel ref={ref} selectable={true} />, { wrapper: false });

            expect(ref.current?.getSelectable()).toBe(true);
        });

        it("sets numeric properties", async () => {
            const ref = createRef<Gtk.Label>();

            await render(<GtkLabel ref={ref} maxWidthChars={20} />, { wrapper: false });

            expect(ref.current?.getMaxWidthChars()).toBe(20);
        });

        it("sets enum properties", async () => {
            const ref = createRef<Gtk.Box>();

            await render(<GtkBox ref={ref} spacing={0} orientation={Gtk.Orientation.VERTICAL} />, { wrapper: false });

            expect(ref.current?.getOrientation()).toBe(Gtk.Orientation.VERTICAL);
        });
    });

    describe("change detection", () => {
        it("skips update when value unchanged", async () => {
            const ref = createRef<Gtk.Label>();

            function App() {
                return <GtkLabel ref={ref} label="Same" />;
            }

            await render(<App />, { wrapper: false });

            const initialId = ref.current?.id;

            await render(<App />, { wrapper: false });

            expect(ref.current?.id).toEqual(initialId);
            expect(ref.current?.getLabel()).toBe("Same");
        });

        it("applies update when value changed", async () => {
            const ref = createRef<Gtk.Label>();

            function App({ text }: { text: string }) {
                return <GtkLabel ref={ref} label={text} />;
            }

            await render(<App text="Initial" />, { wrapper: false });
            expect(ref.current?.getLabel()).toBe("Initial");

            await render(<App text="Updated" />, { wrapper: false });
            expect(ref.current?.getLabel()).toBe("Updated");
        });

        it("handles undefined to value transition", async () => {
            const ref = createRef<Gtk.Label>();

            function App({ label }: { label?: string }) {
                return <GtkLabel ref={ref} label={label} />;
            }

            await render(<App label={undefined} />, { wrapper: false });

            await render(<App label="Now Set" />, { wrapper: false });

            expect(ref.current?.getLabel()).toBe("Now Set");
        });

        it("handles value to undefined transition", async () => {
            const ref = createRef<Gtk.Label>();

            function App({ label }: { label?: string }) {
                return <GtkLabel ref={ref} label={label} />;
            }

            await render(<App label="Has Value" />, { wrapper: false });
            expect(ref.current?.getLabel()).toBe("Has Value");

            await render(<App label={undefined} />, { wrapper: false });
        });
    });

    describe("consumed props", () => {
        it("does not pass children prop to widget", async () => {
            const ref = createRef<Gtk.Box>();

            await render(
                <GtkBox ref={ref} spacing={0} orientation={Gtk.Orientation.VERTICAL}>
                    Child
                </GtkBox>,
                { wrapper: false },
            );

            expect(ref.current).not.toBeNull();
        });

        it("handles node-specific consumed props", async () => {
            const ref = createRef<Gtk.Switch>();

            await render(<GtkSwitch ref={ref} active={true} />, { wrapper: false });

            expect(ref.current?.getActive()).toBe(true);
        });
    });
});
