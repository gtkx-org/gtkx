import * as Graphene from "@gtkx/gi/graphene";
import * as Gsk from "@gtkx/gi/gsk";
import * as Gtk from "@gtkx/gi/gtk";
import { registerClass } from "@gtkx/runtime";

/* GtkCustomLayout annotates its stored callbacks as scope=call in GTK 4.22 GIR.
 * A registered layout manager keeps the allocation vfunc alive for the widget lifetime.
 */
class AnimationLayout extends Gtk.LayoutManager {
    static {
        registerClass(AnimationLayout, { typeName: "GtkxAdwaitaDemoAnimationLayout" });
    }

    private progress = 0;

    setProgress(value: number): void {
        this.progress = value;
        this.getWidget()?.queueAllocate();
    }

    override vfuncMeasure(
        widget: Gtk.Widget,
        orientation: Gtk.Orientation,
        forSize: number,
    ): [number, number, number, number] {
        return widget.getFirstChild()?.measure(orientation, forSize) ?? [0, 0, -1, -1];
    }

    override vfuncAllocate(widget: Gtk.Widget, width: number, height: number, baseline: number): void {
        const child = widget.getFirstChild();
        if (child === null) return;
        const [childWidth] = child.measure(Gtk.Orientation.HORIZONTAL, -1);
        const offset = Math.trunc((width - childWidth) * (this.progress - 0.5));
        child.allocate(width, height, baseline, Gsk.Transform.new().translate(new Graphene.Point({ x: offset, y: 0 })));
    }
}

export { AnimationLayout };
