import type * as Gtk from "@gtkx/ffi/gtk";
import type { Props } from "../types.js";
import { primitiveArrayEqual } from "./internal/utils.js";
import { WidgetNode } from "./widget.js";

type CalendarProps = Props & {
    markedDays?: number[] | null;
};

const OWN_PROPS = ["markedDays"] as const;

export class CalendarNode extends WidgetNode<Gtk.Calendar> {
    protected override readonly excludedPropNames = OWN_PROPS;
    private appliedMarks: number[] = [];

    public override commitUpdate(oldProps: CalendarProps | null, newProps: CalendarProps): void {
        super.commitUpdate(oldProps, newProps);
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
