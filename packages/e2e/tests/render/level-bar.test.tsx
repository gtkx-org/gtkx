import { createRef as createNativeRef } from "@gtkx/ffi";
import type * as Gtk from "@gtkx/ffi/gtk";
import { GtkLevelBar } from "@gtkx/react";
import { render } from "@gtkx/testing";
import { createRef } from "react";
import { describe, expect, it } from "vitest";

describe("render - LevelBar", () => {
    describe("LevelBarNode", () => {
        it("creates LevelBar widget without offsets", async () => {
            const ref = createRef<Gtk.LevelBar>();

            await render(<GtkLevelBar ref={ref} />);

            expect(ref.current).not.toBeNull();
        });

        it("creates LevelBar widget with offsets", async () => {
            const ref = createRef<Gtk.LevelBar>();

            await render(
                <GtkLevelBar
                    ref={ref}
                    offsets={[
                        { id: "low", value: 0.25 },
                        { id: "high", value: 0.75 },
                    ]}
                />,
            );

            expect(ref.current).not.toBeNull();

            const lowValue = createNativeRef(0);
            const hasLow = ref.current?.getOffsetValue(lowValue, "low");
            expect(hasLow).toBe(true);
            expect(lowValue.value).toBe(0.25);

            const highValue = createNativeRef(0);
            const hasHigh = ref.current?.getOffsetValue(highValue, "high");
            expect(hasHigh).toBe(true);
            expect(highValue.value).toBe(0.75);
        });

        it("updates offset value", async () => {
            const ref = createRef<Gtk.LevelBar>();

            function App({ value }: { value: number }) {
                return <GtkLevelBar ref={ref} offsets={[{ id: "threshold", value }]} />;
            }

            await render(<App value={0.5} />);

            const valueRef = createNativeRef(0);
            ref.current?.getOffsetValue(valueRef, "threshold");
            expect(valueRef.value).toBe(0.5);

            await render(<App value={0.75} />);

            ref.current?.getOffsetValue(valueRef, "threshold");
            expect(valueRef.value).toBe(0.75);
        });

        it("updates offset name", async () => {
            const ref = createRef<Gtk.LevelBar>();

            function App({ name }: { name: string }) {
                return <GtkLevelBar ref={ref} offsets={[{ id: name, value: 0.5 }]} />;
            }

            await render(<App name="old-name" />);

            const valueRef = createNativeRef(0);
            expect(ref.current?.getOffsetValue(valueRef, "old-name")).toBe(true);
            expect(ref.current?.getOffsetValue(valueRef, "new-name")).toBe(false);

            await render(<App name="new-name" />);

            expect(ref.current?.getOffsetValue(valueRef, "old-name")).toBe(false);
            expect(ref.current?.getOffsetValue(valueRef, "new-name")).toBe(true);
        });

        it("removes offsets when array changes", async () => {
            const ref = createRef<Gtk.LevelBar>();

            function App({ showExtra }: { showExtra: boolean }) {
                const offsets = showExtra
                    ? [
                          { id: "always", value: 0.5 },
                          { id: "extra", value: 0.75 },
                      ]
                    : [{ id: "always", value: 0.5 }];
                return <GtkLevelBar ref={ref} offsets={offsets} />;
            }

            await render(<App showExtra={true} />);

            const valueRef = createNativeRef(0);
            expect(ref.current?.getOffsetValue(valueRef, "always")).toBe(true);
            expect(ref.current?.getOffsetValue(valueRef, "extra")).toBe(true);

            await render(<App showExtra={false} />);

            expect(ref.current?.getOffsetValue(valueRef, "always")).toBe(true);
            expect(ref.current?.getOffsetValue(valueRef, "extra")).toBe(false);
        });
    });
});
