import type { ComponentType } from "react";

export type DemoProps = {
    onClose?: () => void;
};

export type Demo = {
    id: string;
    title: string;
    description: string;
    keywords: string[];
    component?: ComponentType<DemoProps>;
    sourceCode?: string;
};

export type TreeItem =
    | { type: "category"; title: string; children: TreeItem[] }
    | { type: "demo"; demo: Demo; displayTitle: string };
