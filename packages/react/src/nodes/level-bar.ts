import type * as Gtk from "@gtkx/gi/gtk";
import { isShallowArrayEqual } from "@gtkx/utils";
import type { GtkLevelBarProps, LevelBarOffset } from "../jsx.js";
import { arraySync, type PropDescriptorTable } from "./internal/apply-props.js";
import { WidgetNode } from "./widget.js";

type LevelBarProps = Pick<GtkLevelBarProps, "offsets">;

export class LevelBarNode extends WidgetNode<Gtk.LevelBar, LevelBarProps> {
    protected override ownPropDescriptors(): PropDescriptorTable {
        return {
            ...super.ownPropDescriptors(),
            offsets: arraySync<LevelBarOffset, string>({
                equal: isShallowArrayEqual,
                clearItem: (id) => this.backingInstance.removeOffsetValue(id),
                add: (offset) => {
                    this.backingInstance.addOffsetValue(offset.id, offset.value);
                    return offset.id;
                },
            }),
        };
    }
}
