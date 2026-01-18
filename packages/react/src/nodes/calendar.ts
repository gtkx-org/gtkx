import * as Gtk from "@gtkx/ffi/gtk";
import { registerNodeClass } from "../registry.js";
import type { Container, ContainerClass, Props } from "../types.js";
import { isContainerType } from "./internal/utils.js";
import { WidgetNode } from "./widget.js";

type CalendarProps = Props & {
    markedDays?: number[] | null;
};

class CalendarNode extends WidgetNode<Gtk.Calendar> {
    public static override priority = 1;

    private appliedMarks: number[] = [];

    public static override matches(_type: string, containerOrClass?: Container | ContainerClass | null): boolean {
        return isContainerType(Gtk.Calendar, containerOrClass);
    }

    public override updateProps(oldProps: CalendarProps | null, newProps: CalendarProps): void {
        super.updateProps(oldProps, newProps);
        this.updateMarkedDays(oldProps, newProps);
    }

    private updateMarkedDays(_oldProps: CalendarProps | null, newProps: CalendarProps): void {
        const newMarkedDays = newProps.markedDays ?? [];

        if (this.markedDaysEqual(this.appliedMarks, newMarkedDays)) {
            return;
        }

        this.container.clearMarks();

        for (const day of newMarkedDays) {
            this.container.markDay(day);
        }

        this.appliedMarks = [...newMarkedDays];
    }

    private markedDaysEqual(a: number[], b: number[]): boolean {
        if (a.length !== b.length) return false;
        for (let i = 0; i < a.length; i++) {
            if (a[i] !== b[i]) return false;
        }
        return true;
    }
}

registerNodeClass(CalendarNode);
