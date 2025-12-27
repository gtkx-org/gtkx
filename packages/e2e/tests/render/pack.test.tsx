import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkLabel } from "@gtkx/react";
import { render } from "@gtkx/testing";
import { createRef } from "react";
import { describe, expect, it } from "vitest";

describe("render - Pack", () => {
    describe("PackNode (GtkBox)", () => {
        it("creates Box widget", async () => {
            const ref = createRef<Gtk.Box>();

            await render(<GtkBox ref={ref} spacing={0} orientation={Gtk.Orientation.HORIZONTAL} />, { wrapper: false });

            expect(ref.current).not.toBeNull();
        });

        it("appends children", async () => {
            const boxRef = createRef<Gtk.Box>();

            await render(
                <GtkBox ref={boxRef} spacing={0} orientation={Gtk.Orientation.HORIZONTAL}>
                    First Second
                </GtkBox>,
                { wrapper: false },
            );

            expect(boxRef.current?.getFirstChild()).not.toBeNull();
            expect(boxRef.current?.getLastChild()).not.toBeNull();
        });

        it("removes children", async () => {
            const boxRef = createRef<Gtk.Box>();

            function App({ count }: { count: number }) {
                return (
                    <GtkBox ref={boxRef} spacing={0} orientation={Gtk.Orientation.HORIZONTAL}>
                        {Array.from({ length: count }, (_, i) => (
                            // biome-ignore lint/suspicious/noArrayIndexKey: Test intentionally uses index keys
                            <GtkLabel key={`label-${i}`} label={`Label ${i}`} />
                        ))}
                    </GtkBox>
                );
            }

            await render(<App count={3} />, { wrapper: false });
            await render(<App count={1} />, { wrapper: false });

            expect(boxRef.current?.getFirstChild()).not.toBeNull();
            expect(boxRef.current?.getFirstChild()?.equals(boxRef.current?.getLastChild())).toBe(true);
        });
    });
});
