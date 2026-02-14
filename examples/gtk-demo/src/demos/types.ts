import type * as Gtk from "@gtkx/ffi/gtk";
import type { ComponentType, RefObject } from "react";

export type DemoProps = {
    onClose?: () => void;
    window: RefObject<Gtk.Window | null>;
};

export type Demo = {
    id: string;
    title: string;
    description: string;
    keywords: string[];
    component?: ComponentType<DemoProps>;
    sourceCode?: string;
    defaultWidth?: number;
    defaultHeight?: number;
    dialogOnly?: boolean;
};

export type TreeItem =
    | { type: "category"; title: string; children: TreeItem[] }
    | { type: "demo"; demo: Demo; displayTitle: string };
