import type * as Gtk from "@gtkx/gi/gtk";
import { GtkCalendar } from "@gtkx/jsx/gtk";
import { render } from "@gtkx/testing";
import { createRef, type ReactNode, type Ref } from "react";
import { describe, expect, it } from "vitest";

type MarkedCalendarProps = { calendarRef: Ref<Gtk.Calendar>; days: number[] };

const MarkedCalendar = ({ calendarRef, days }: MarkedCalendarProps): ReactNode => (
    <GtkCalendar ref={calendarRef} markedDays={days} />
);

describe("render - Calendar > basic", () => {
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
});

describe("render - Calendar > marks updates", () => {
    it("updates marks when prop changes", async () => {
        const ref = createRef<Gtk.Calendar>();
        await render(<MarkedCalendar calendarRef={ref} days={[15]} />);
        expect(ref.current?.getDayIsMarked(15)).toBe(true);
        expect(ref.current?.getDayIsMarked(20)).toBe(false);
        await render(<MarkedCalendar calendarRef={ref} days={[20]} />);
        expect(ref.current?.getDayIsMarked(15)).toBe(false);
        expect(ref.current?.getDayIsMarked(20)).toBe(true);
    });

    it("removes marks when array changes", async () => {
        const ref = createRef<Gtk.Calendar>();
        await render(<MarkedCalendar calendarRef={ref} days={[15, 20]} />);
        expect(ref.current?.getDayIsMarked(15)).toBe(true);
        expect(ref.current?.getDayIsMarked(20)).toBe(true);
        await render(<MarkedCalendar calendarRef={ref} days={[15]} />);
        expect(ref.current?.getDayIsMarked(15)).toBe(true);
        expect(ref.current?.getDayIsMarked(20)).toBe(false);
    });

    it("handles adding marks dynamically", async () => {
        const ref = createRef<Gtk.Calendar>();
        await render(<MarkedCalendar calendarRef={ref} days={[10, 20]} />);
        expect(ref.current?.getDayIsMarked(10)).toBe(true);
        expect(ref.current?.getDayIsMarked(15)).toBe(false);
        expect(ref.current?.getDayIsMarked(20)).toBe(true);
        await render(<MarkedCalendar calendarRef={ref} days={[10, 15, 20]} />);
        expect(ref.current?.getDayIsMarked(10)).toBe(true);
        expect(ref.current?.getDayIsMarked(15)).toBe(true);
        expect(ref.current?.getDayIsMarked(20)).toBe(true);
    });
});
