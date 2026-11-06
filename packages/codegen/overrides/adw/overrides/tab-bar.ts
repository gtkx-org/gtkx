import { getHandle } from "@gtkx/runtime";
import { connectNativeSignal, initializeWrapper, isNativeHandleAlive } from "@gtkx/runtime/internal";
import { ConnectFlags } from "@gtkx/gi/gobject";
import { ScrolledWindow, type Widget } from "@gtkx/gi/gtk";
import { TabBar } from "../adw.js";

const tabBoxes = (bar: TabBar): Widget[] => {
    const boxes: Widget[] = [];
    const pending: Widget[] = [];

    for (let child = bar.getFirstChild(); child !== null; child = child.getNextSibling()) {
        pending.push(child);
    }

    for (let widget = pending.pop(); widget !== undefined; widget = pending.pop()) {
        if (widget instanceof ScrolledWindow) {
            const box = widget.getChild();

            if (box !== null) {
                boxes.push(box);
            }

            continue;
        }

        for (let child = widget.getFirstChild(); child !== null; child = child.getNextSibling()) {
            pending.push(child);
        }
    }

    return boxes;
};

const isAlive = (widget: Widget): boolean => isNativeHandleAlive(getHandle(widget));

const disposeTabBox = (box: Widget): void => {
    const parent = isAlive(box) ? box.getParent() : null;

    if (parent instanceof ScrolledWindow) {
        parent.setChild(null);
    }

    if (isAlive(box)) {
        box.runDispose();
    }
};

/* libadwaita's tab boxes keep a plain pointer to their TabBar, and the tabs a box drops when the bar is destroyed
 * still follow their pages, so a retained tab and box crash at the view's next selection change. Dispose the
 * boxes with the bar.
 */
Object.defineProperty(TabBar.prototype, initializeWrapper, {
    value: function (this: TabBar): void {
        const boxes = tabBoxes(this);
        connectNativeSignal(
            this,
            "destroy",
            () => {
                for (const box of boxes) {
                    disposeTabBox(box);
                }
            },
            ConnectFlags.DEFAULT,
        );
    },
});
