import type * as Gtk from "@gtkx/ffi/gtk";
import type { Props } from "../types.js";
import { filterProps, primitiveArrayEqual } from "./internal/utils.js";
import { WidgetNode } from "./widget.js";

type CalendarProps = Props & {
    markedDays?: number[] | null;
};

const OWN_PROPS = ["markedDays"] as const;

export class CalendarNode extends WidgetNode<Gtk.Calendar> {
    private appliedMarks: number[] = [];

    protected override applyUpdate(oldProps: CalendarProps | null, newProps: CalendarProps): void {
        super.applyUpdate(
            oldProps ? (filterProps(oldProps, OWN_PROPS) as CalendarProps) : null,
            filterProps(newProps, OWN_PROPS) as CalendarProps,
        );
        this.applyOwnProps(oldProps, newProps);
    }

    protected applyOwnProps(_oldProps: CalendarProps | null, newProps: CalendarProps): void {
        this.applyMarkedDays(newProps);
    }

    private applyMarkedDays(newProps: CalendarProps): void {
        const newMarkedDays = newProps.markedDays ?? [];

        if (primitiveArrayEqual(this.appliedMarks, newMarkedDays)) {
            return;
        }

        this.container.clearMarks();

        for (const day of newMarkedDays) {
            this.container.markDay(day);
        }

        this.appliedMarks = [...newMarkedDays];
    }
}
