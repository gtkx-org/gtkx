import type * as Gtk from "@gtkx/gi/gtk";
import type { ComponentType, ReactNode, RefObject } from "react";

export type DemoProps = {
    onClose?: () => void;
    window: RefObject<Gtk.Window | null>;
};

export type DemoProviderProps = DemoProps & {
    children: ReactNode;
};

export type Demo = {
    id: string;
    title: string;
    description: string;
    keywords: string[];
    component?: ComponentType<DemoProps>;
    titlebar?: ComponentType<DemoProps>;
    provider?: ComponentType<DemoProviderProps>;
    sourceCode?: string;
    defaultWidth?: number;
    defaultHeight?: number;
    dialogOnly?: boolean;
    windowTitle?: string;
    resizable?: boolean;
    deletable?: boolean;
    windowCssClasses?: string[];
};

export type TreeItem =
    | { type: "category"; title: string; children: TreeItem[] }
    | { type: "demo"; demo: Demo; displayTitle: string };
