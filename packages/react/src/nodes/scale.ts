import * as Gtk from "@gtkx/ffi/gtk";
import type { ScaleMark } from "../jsx.js";
import { AdjustableNode } from "./adjustable.js";
import { arraySync, type PropDescriptorTable } from "./internal/apply-props.js";
import { isShallowArrayEqual } from "@gtkx/utils";

export class ScaleNode extends AdjustableNode<Gtk.Scale> {
    protected override ownPropDescriptors(): PropDescriptorTable {
        return {
            ...super.ownPropDescriptors(),
            marks: arraySync<ScaleMark, void>({
                equal: isShallowArrayEqual,
                clearAll: () => this.container.clearMarks(),
                add: (mark) => {
                    this.container.addMark(mark.value, mark.position ?? Gtk.PositionType.BOTTOM, mark.label ?? null);
                },
            }),
        };
    }
}
