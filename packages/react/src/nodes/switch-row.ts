import type * as Adw from "@gtkx/ffi/adw";
import { type PropDescriptorTable, signal } from "./internal/apply-props.js";
import { WidgetNode } from "./widget.js";

type SwitchRowProps = {
    onActiveChanged?: ((active: boolean) => void) | null;
};

export class SwitchRowNode extends WidgetNode<Adw.SwitchRow, SwitchRowProps> {
    protected override ownPropDescriptors(): PropDescriptorTable {
        return {
            ...super.ownPropDescriptors(),
            onActiveChanged: signal("notify::active", {
                getArgs: () => [this.container.getActive()],
            }),
        };
    }
}
