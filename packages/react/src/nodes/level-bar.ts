import type * as Gtk from "@gtkx/ffi/gtk";
import type { GtkLevelBarProps } from "../jsx.js";
import { arraySync, type PropDescriptorTable } from "./internal/apply-props.js";
import { shallowArrayEqual } from "./internal/props.js";
import { WidgetNode } from "./widget.js";

type LevelBarProps = Pick<GtkLevelBarProps, "offsets">;
type Offset = { id: string; value: number };

export class LevelBarNode extends WidgetNode<Gtk.LevelBar, LevelBarProps> {
    protected override ownPropDescriptors(): PropDescriptorTable {
        return {
            ...super.ownPropDescriptors(),
            offsets: arraySync<Offset, string>({
                equal: shallowArrayEqual,
                clearItem: (id) => this.container.removeOffsetValue(id),
                add: (offset) => {
                    this.container.addOffsetValue(offset.id, offset.value);
                    return offset.id;
                },
            }),
        };
    }
}
