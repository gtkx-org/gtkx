import type * as Gtk from "@gtkx/ffi/gtk";
import type { GtkCalendarProps } from "../jsx.js";
import type { Node } from "../node.js";
import { ContainerSlotNode } from "./container-slot.js";
import { EventControllerNode } from "./event-controller.js";
import { arraySync, type PropDescriptorTable } from "./internal/apply-props.js";
import { primitiveArrayEqual } from "./internal/props.js";
import { SlotNode } from "./slot.js";
import { WidgetNode } from "./widget.js";

type CalendarProps = Pick<GtkCalendarProps, "markedDays">;
type CalendarChild = EventControllerNode | SlotNode | ContainerSlotNode;

export class CalendarNode extends WidgetNode<Gtk.Calendar, CalendarProps, CalendarChild> {
    public override isValidChild(child: Node): boolean {
        return child instanceof EventControllerNode || child instanceof SlotNode || child instanceof ContainerSlotNode;
    }

    protected override ownPropDescriptors(): PropDescriptorTable {
        return {
            ...super.ownPropDescriptors(),
            markedDays: arraySync<number, number>({
                equal: primitiveArrayEqual,
                clearAll: () => this.container.clearMarks(),
                add: (day) => {
                    this.container.markDay(day);
                    return day;
                },
            }),
        };
    }
}
