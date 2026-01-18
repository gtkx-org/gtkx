import * as Gtk from "@gtkx/ffi/gtk";
import { registerNodeClass } from "../registry.js";
import type { Container, ContainerClass, Props } from "../types.js";
import { isContainerType } from "./internal/utils.js";
import { WidgetNode } from "./widget.js";

type LevelBarOffset = {
    id: string;
    value: number;
};

type LevelBarProps = Props & {
    offsets?: LevelBarOffset[] | null;
};

class LevelBarNode extends WidgetNode<Gtk.LevelBar> {
    public static override priority = 1;

    private appliedOffsetIds = new Set<string>();

    public static override matches(_type: string, containerOrClass?: Container | ContainerClass | null): boolean {
        return isContainerType(Gtk.LevelBar, containerOrClass);
    }

    public override updateProps(oldProps: LevelBarProps | null, newProps: LevelBarProps): void {
        super.updateProps(oldProps, newProps);
        this.updateOffsets(oldProps, newProps);
    }

    private updateOffsets(oldProps: LevelBarProps | null, newProps: LevelBarProps): void {
        const newOffsets = newProps.offsets ?? [];

        if (this.offsetsEqual(oldProps?.offsets ?? [], newOffsets)) {
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

    private offsetsEqual(a: LevelBarOffset[], b: LevelBarOffset[]): boolean {
        if (a.length !== b.length) return false;
        for (let i = 0; i < a.length; i++) {
            const offsetA = a[i];
            const offsetB = b[i];
            if (!offsetA || !offsetB) return false;
            if (offsetA.id !== offsetB.id) return false;
            if (offsetA.value !== offsetB.value) return false;
        }
        return true;
    }
}

registerNodeClass(LevelBarNode);
