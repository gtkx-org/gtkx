import * as Gtk from "@gtkx/ffi/gtk";
import { registerNodeClass } from "../registry.js";
import type { Container, ContainerClass, Props } from "../types.js";
import { AdjustableNode } from "./adjustable.js";
import { isContainerType } from "./internal/utils.js";

type ScaleMark = {
    value: number;
    position?: Gtk.PositionType;
    label?: string | null;
};

type ScaleProps = Props & {
    marks?: ScaleMark[] | null;
};

class ScaleNode extends AdjustableNode<Gtk.Scale> {
    public static override priority = 1;

    private appliedMarks: ScaleMark[] = [];

    public static override matches(_type: string, containerOrClass?: Container | ContainerClass | null): boolean {
        return isContainerType(Gtk.Scale, containerOrClass);
    }

    public override updateProps(oldProps: ScaleProps | null, newProps: ScaleProps): void {
        super.updateProps(oldProps, newProps);
        this.updateMarks(oldProps, newProps);
    }

    private updateMarks(_oldProps: ScaleProps | null, newProps: ScaleProps): void {
        const newMarks = newProps.marks ?? [];

        if (this.marksEqual(this.appliedMarks, newMarks)) {
            return;
        }

        this.container.clearMarks();

        for (const mark of newMarks) {
            this.container.addMark(mark.value, mark.position ?? Gtk.PositionType.BOTTOM, mark.label);
        }

        this.appliedMarks = [...newMarks];
    }

    private marksEqual(a: ScaleMark[], b: ScaleMark[]): boolean {
        if (a.length !== b.length) return false;
        for (let i = 0; i < a.length; i++) {
            const markA = a[i];
            const markB = b[i];
            if (!markA || !markB) return false;
            if (markA.value !== markB.value) return false;
            if (markA.position !== markB.position) return false;
            if (markA.label !== markB.label) return false;
        }
        return true;
    }
}

registerNodeClass(ScaleNode);
