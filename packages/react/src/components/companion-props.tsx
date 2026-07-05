import * as Graphene from "@gtkx/gi/graphene";
import * as Gsk from "@gtkx/gi/gsk";
import { createElement, type ReactNode } from "react";

type FixedTransformProps = {
    x?: number | undefined;
    y?: number | undefined;
    transform?: Gsk.Transform | null | undefined;
};

const composeTransform = (x: number, y: number, transform: Gsk.Transform | null | undefined): Gsk.Transform | null => {
    const point = new Graphene.Point();
    point.init(x, y);
    let composed = Gsk.Transform.new().translate(point);
    if (transform != null && composed !== null) composed = composed.transform(transform);
    return composed;
};

export const withFixedTransform = <P extends { transform?: Gsk.Transform | null | undefined }>(
    Component: (props: P) => ReactNode,
): ((props: Omit<P, "transform"> & FixedTransformProps) => ReactNode) => {
    return (props) => {
        const { x, y, transform, ...rest } = props;
        const composed = composeTransform(x ?? 0, y ?? 0, transform);
        return <Component {...(rest as P)} transform={composed} />;
    };
};

type NotebookTabProps = {
    label?: string | undefined;
    tabLabel?: ReactNode;
};

export const withNotebookTabLabel = <P extends { tabLabel?: ReactNode }>(
    Component: (props: P) => ReactNode,
): ((props: Omit<P, "tabLabel"> & NotebookTabProps) => ReactNode) => {
    return (props) => {
        const { label, tabLabel, ...rest } = props;
        const resolved = tabLabel ?? (label !== undefined ? createElement("GtkLabel", { label }) : undefined);
        return <Component {...(rest as P)} tabLabel={resolved} />;
    };
};
