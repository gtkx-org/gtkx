import * as Gtk from "@gtkx/gi/gtk";
import { isShallowArrayEqual } from "@gtkx/utils";
import type { ScaleMark } from "../jsx.js";
import { AdjustableNode } from "./adjustable.js";
import { arraySync, type PropDescriptorTable } from "./internal/apply-props.js";

export class ScaleNode extends AdjustableNode<Gtk.Scale> {
    protected override ownPropDescriptors(): PropDescriptorTable {
        return {
            ...super.ownPropDescriptors(),
            marks: arraySync<ScaleMark, void>({
                equal: isShallowArrayEqual,
                clearAll: () => this.backingInstance.clearMarks(),
                add: (mark) => {
                    this.backingInstance.addMark(
                        mark.value,
                        mark.position ?? Gtk.PositionType.BOTTOM,
                        mark.label ?? null,
                    );
                },
            }),
        };
    }
}
