import type * as Gtk from "@gtkx/ffi/gtk";
import { GtkCalendar } from "@gtkx/react";
import { render } from "@gtkx/testing";
import { createRef } from "react";
import { describe, expect, it } from "vitest";

describe("render - Calendar", () => {
    describe("CalendarNode", () => {
        it("creates Calendar widget without marks", async () => {
            const ref = createRef<Gtk.Calendar>();

            await render(<GtkCalendar ref={ref} />);

            expect(ref.current).not.toBeNull();
        });

        it("creates Calendar widget with marks", async () => {
            const ref = createRef<Gtk.Calendar>();

            await render(<GtkCalendar ref={ref} markedDays={[15, 20, 25]} />);

            expect(ref.current).not.toBeNull();
            expect(ref.current?.getDayIsMarked(15)).toBe(true);
            expect(ref.current?.getDayIsMarked(20)).toBe(true);
            expect(ref.current?.getDayIsMarked(25)).toBe(true);
            expect(ref.current?.getDayIsMarked(10)).toBe(false);
        });

        it("updates marks when prop changes", async () => {
            const ref = createRef<Gtk.Calendar>();

            function App({ days }: { days: number[] }) {
                return <GtkCalendar ref={ref} markedDays={days} />;
            }

            await render(<App days={[15]} />);
            expect(ref.current?.getDayIsMarked(15)).toBe(true);
            expect(ref.current?.getDayIsMarked(20)).toBe(false);

            await render(<App days={[20]} />);
            expect(ref.current?.getDayIsMarked(15)).toBe(false);
            expect(ref.current?.getDayIsMarked(20)).toBe(true);
        });

        it("removes marks when array changes", async () => {
            const ref = createRef<Gtk.Calendar>();

            function App({ showExtra }: { showExtra: boolean }) {
                const days = showExtra ? [15, 20] : [15];
                return <GtkCalendar ref={ref} markedDays={days} />;
            }

            await render(<App showExtra={true} />);
            expect(ref.current?.getDayIsMarked(15)).toBe(true);
            expect(ref.current?.getDayIsMarked(20)).toBe(true);

            await render(<App showExtra={false} />);
            expect(ref.current?.getDayIsMarked(15)).toBe(true);
            expect(ref.current?.getDayIsMarked(20)).toBe(false);
        });

        it("handles adding marks dynamically", async () => {
            const ref = createRef<Gtk.Calendar>();

            function App({ showMid }: { showMid: boolean }) {
                const days = showMid ? [10, 15, 20] : [10, 20];
                return <GtkCalendar ref={ref} markedDays={days} />;
            }

            await render(<App showMid={false} />);
            expect(ref.current?.getDayIsMarked(10)).toBe(true);
            expect(ref.current?.getDayIsMarked(15)).toBe(false);
            expect(ref.current?.getDayIsMarked(20)).toBe(true);

            await render(<App showMid={true} />);
            expect(ref.current?.getDayIsMarked(10)).toBe(true);
            expect(ref.current?.getDayIsMarked(15)).toBe(true);
            expect(ref.current?.getDayIsMarked(20)).toBe(true);
        });
    });
});
