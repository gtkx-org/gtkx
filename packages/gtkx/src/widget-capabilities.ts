import type * as gtk from "@gtkx/ffi/gtk";

export interface Appendable extends gtk.Widget {
    append(child: unknown): void;
}

export interface SingleChild extends gtk.Widget {
    setChild(child: unknown): void;
}

export interface Removable extends gtk.Widget {
    remove(child: unknown): void;
}

export interface Presentable extends gtk.Widget {
    present(): void;
}

export interface Connectable extends gtk.Widget {
    connect(signal: string, handler: (...args: unknown[]) => unknown, after?: boolean): number;
}

export interface DefaultSizable extends gtk.Widget {
    setDefaultSize(width: number, height: number): void;
}

export interface ModelSettable extends gtk.Widget {
    setModel(model: unknown): void;
}

export interface Selectable extends gtk.Widget {
    getSelected(): number;
}

export interface GridAttachable extends gtk.Widget {
    attach(child: unknown, column: number, row: number, width: number, height: number): void;
}

export interface NotebookLike extends gtk.Widget {
    appendPage(child: unknown, tabLabel?: unknown): number;
    pageNum(child: unknown): number;
    removePage(pageNum: number): void;
}

export const isAppendable = (widget: gtk.Widget): widget is Appendable =>
    "append" in widget && typeof widget.append === "function";

export const isSingleChild = (widget: gtk.Widget): widget is SingleChild =>
    "setChild" in widget && typeof widget.setChild === "function";

export const isRemovable = (widget: gtk.Widget): widget is Removable =>
    "remove" in widget && typeof widget.remove === "function";

export const isPresentable = (widget: gtk.Widget): widget is Presentable =>
    "present" in widget && typeof widget.present === "function";

export const isConnectable = (widget: gtk.Widget): widget is Connectable =>
    "connect" in widget && typeof widget.connect === "function";

export const isDefaultSizable = (widget: gtk.Widget): widget is DefaultSizable =>
    "setDefaultSize" in widget && typeof widget.setDefaultSize === "function";

export const isModelSettable = (widget: gtk.Widget): widget is ModelSettable =>
    "setModel" in widget && typeof widget.setModel === "function";

export const isSelectable = (widget: gtk.Widget): widget is Selectable =>
    "getSelected" in widget && typeof widget.getSelected === "function";

export const isGridAttachable = (widget: gtk.Widget): widget is GridAttachable =>
    "attach" in widget && typeof widget.attach === "function";

export const isNotebookLike = (widget: gtk.Widget): widget is NotebookLike =>
    "appendPage" in widget &&
    typeof widget.appendPage === "function" &&
    "pageNum" in widget &&
    typeof widget.pageNum === "function" &&
    "removePage" in widget &&
    typeof widget.removePage === "function";

export const appendChild = (parent: gtk.Widget, child: gtk.Widget): void => {
    if (isSingleChild(parent)) {
        parent.setChild(child.ptr);
    } else if (isAppendable(parent)) {
        parent.append(child.ptr);
    }
};

export const removeChild = (parent: gtk.Widget, child: gtk.Widget): void => {
    if (isRemovable(parent)) {
        parent.remove(child.ptr);
    } else if (isSingleChild(parent)) {
        parent.setChild(null);
    }
};

export { disconnectSignalHandlers } from "./signal-utils.js";
