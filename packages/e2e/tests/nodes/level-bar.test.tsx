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

            const [hasLow, lowValue] = ref.current?.getOffsetValue("low") ?? [false, 0];
            expect(hasLow).toBe(true);
            expect(lowValue).toBe(0.25);

            const [hasHigh, highValue] = ref.current?.getOffsetValue("high") ?? [false, 0];
            expect(hasHigh).toBe(true);
            expect(highValue).toBe(0.75);
        });

        it("updates offset value", async () => {
            const ref = createRef<Gtk.LevelBar>();

            function App({ value }: { value: number }) {
                return <GtkLevelBar ref={ref} offsets={[{ id: "threshold", value }]} />;
            }

            await render(<App value={0.5} />);

            expect(ref.current?.getOffsetValue("threshold")?.[1]).toBe(0.5);

            await render(<App value={0.75} />);

            expect(ref.current?.getOffsetValue("threshold")?.[1]).toBe(0.75);
        });

        it("updates offset name", async () => {
            const ref = createRef<Gtk.LevelBar>();

            function App({ name }: { name: string }) {
                return <GtkLevelBar ref={ref} offsets={[{ id: name, value: 0.5 }]} />;
            }

            await render(<App name="old-name" />);

            expect(ref.current?.getOffsetValue("old-name")?.[0]).toBe(true);
            expect(ref.current?.getOffsetValue("new-name")?.[0]).toBe(false);

            await render(<App name="new-name" />);

            expect(ref.current?.getOffsetValue("old-name")?.[0]).toBe(false);
            expect(ref.current?.getOffsetValue("new-name")?.[0]).toBe(true);
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

            expect(ref.current?.getOffsetValue("always")?.[0]).toBe(true);
            expect(ref.current?.getOffsetValue("extra")?.[0]).toBe(true);

            await render(<App showExtra={false} />);

            expect(ref.current?.getOffsetValue("always")?.[0]).toBe(true);
            expect(ref.current?.getOffsetValue("extra")?.[0]).toBe(false);
        });
    });
});
