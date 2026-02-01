import * as Gtk from "@gtkx/ffi/gtk";
import type { AdjustableProps, GtkScaleProps, ScaleMark } from "../jsx.js";
import { AdjustableNode } from "./adjustable.js";
import { shallowArrayEqual } from "./internal/props.js";

type ScaleProps = AdjustableProps & Pick<GtkScaleProps, "marks">;

export class ScaleNode extends AdjustableNode<Gtk.Scale> {
    private appliedMarks: ScaleMark[] = [];

    public override commitUpdate(oldProps: ScaleProps | null, newProps: ScaleProps): void {
        super.commitUpdate(oldProps, newProps);
        this.applyMarkProps(newProps);
    }

    private applyMarkProps(newProps: ScaleProps): void {
        const newMarks = newProps.marks ?? [];

        if (shallowArrayEqual(this.appliedMarks, newMarks)) {
            return;
        }

        this.container.clearMarks();

        for (const mark of newMarks) {
            this.container.addMark(mark.value, mark.position ?? Gtk.PositionType.BOTTOM, mark.label);
        }

        this.appliedMarks = [...newMarks];
    }
}
