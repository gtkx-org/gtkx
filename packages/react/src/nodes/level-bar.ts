import type * as Gtk from "@gtkx/ffi/gtk";
import type { Props } from "../types.js";
import { filterProps, shallowArrayEqual } from "./internal/utils.js";
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
    private appliedOffsetIds = new Set<string>();

    public override updateProps(oldProps: LevelBarProps | null, newProps: LevelBarProps): void {
        super.updateProps(
            oldProps ? (filterProps(oldProps, OWN_PROPS) as LevelBarProps) : null,
            filterProps(newProps, OWN_PROPS) as LevelBarProps,
        );
        this.applyOwnProps(oldProps, newProps);
    }

    protected applyOwnProps(oldProps: LevelBarProps | null, newProps: LevelBarProps): void {
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
