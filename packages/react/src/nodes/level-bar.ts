import type * as Gtk from "@gtkx/ffi/gtk";
import type { Props } from "../types.js";
import { shallowArrayEqual } from "./internal/utils.js";
import { WidgetNode } from "./widget.js";

type LevelBarOffset = {
    id: string;
    value: number;
};

type LevelBarProps = Props & {
    offsets?: LevelBarOffset[] | null;
};

const OWN_PROPS = ["offsets"] as const;

export class LevelBarNode extends WidgetNode<Gtk.LevelBar> {
    protected override readonly excludedPropNames = OWN_PROPS;
    private appliedOffsetIds = new Set<string>();

    public override commitUpdate(oldProps: LevelBarProps | null, newProps: LevelBarProps): void {
        super.commitUpdate(oldProps, newProps);
        this.applyOffsets(oldProps, newProps);
    }

    private applyOffsets(oldProps: LevelBarProps | null, newProps: LevelBarProps): void {
        const newOffsets = newProps.offsets ?? [];

        if (shallowArrayEqual(oldProps?.offsets ?? [], newOffsets)) {
            return;
        }

        for (const id of this.appliedOffsetIds) {
            this.container.removeOffsetValue(id);
        }
        this.appliedOffsetIds.clear();

        for (const offset of newOffsets) {
            this.container.addOffsetValue(offset.id, offset.value);
            this.appliedOffsetIds.add(offset.id);
        }
    }
}
