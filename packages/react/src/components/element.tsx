import type * as GObject from "@gtkx/gi/gobject";
import { isRecord } from "@gtkx/utils";
import {
    createElement,
    type ElementType,
    isValidElement,
    type ReactElement,
    type ReactNode,
    type Ref,
    use,
    useCallback,
} from "react";
import { assignRef } from "react-merge-refs";
import type { LazyNode } from "../reconciler/node.js";
import type { Props } from "../reconciler/registry.js";
import { useAccessibleMap } from "../hooks/use-accessible-map.js";
import { useMergedRef } from "../hooks/use-merged-refs.js";
import { ELEMENTS } from "../reconciler/registry.js";
import { ControlledChildrenContext } from "./controlled-context.js";

const Prop = "gtkx:prop";
const NO_PROP_CHILDREN: ReactNode[] = [];

const hasElement = (value: unknown): boolean =>
    isValidElement(value) || (Array.isArray(value) && value.some((item: unknown) => hasElement(item)));

const isRoutedProp = (key: string, value: unknown): boolean =>
    key !== "children" && key !== "ref" && hasElement(value);

const collectPropChildren = (record: Props): ReactNode[] | null => {
    let propChildren: ReactNode[] | null = null;

    for (const key in record) {
        if (!isRoutedProp(key, record[key])) {
            continue;
        }

        propChildren ??= [];

        propChildren.push(
            createElement(Prop, { propName: key, key: `${Prop}:${key}` }, record[key] as ReactNode),
        );
    }

    return propChildren;
};

const hostPropsWithout = (record: Props): Props => {
    const hostProps: Props = {};

    for (const key in record) {
        if (key !== "children" && !isRoutedProp(key, record[key])) {
            hostProps[key] = record[key];
        }
    }

    return hostProps;
};

const buildElement = (typeName: string, record: Props): ReactElement => {
    const Host = typeName as ElementType;
    const propChildren = collectPropChildren(record);

    if (propChildren === null) {
        return (
            <Host {...record}>
                {NO_PROP_CHILDREN}
                {record.children as ReactNode}
            </Host>
        );
    }

    return (
        <Host {...hostPropsWithout(record)}>
            {propChildren}
            {record.children as ReactNode}
        </Host>
    );
};

const subscribeLazyRef = (
    node: LazyNode,
    ref: Ref<GObject.Object> | undefined,
    notify: (() => void) | undefined,
): (() => void) => {
    let object: GObject.Object | null = null;
    let cleanup: (() => void) | undefined;
    const publish = () => {
        if (object === node.adopted) {
            return;
        }

        cleanup?.();
        cleanup = undefined;
        object = node.adopted;

        if (object !== null && ref != null) {
            const assigned = assignRef(ref, object);
            cleanup = typeof assigned === "function"
                ? assigned
                : () => {
                        assignRef(ref, null);
                    };
        }

        notify?.();
    };

    publish();
    node.adoptionListeners.add(publish);

    return () => {
        node.adoptionListeners.delete(publish);
        cleanup?.();
    };
};

const LazyElement = ({ typeName, record }: { typeName: string; record: Props }): ReactElement => {
    const ref = record.ref as Ref<GObject.Object> | undefined;
    const context = use(ControlledChildrenContext);
    const notify = context?.typeName === typeName ? context.notify : undefined;
    const attach = useCallback((node: LazyNode | null) =>
        node === null ? undefined : subscribeLazyRef(node, ref, notify), [ref, notify]);

    return buildElement(typeName, { ...record, ref: attach });
};

const Element = ({ typeName, record }: { typeName: string; record: Props }): ReactElement => {
    const ref = record.ref as Ref<GObject.Object> | undefined;
    const accessibleRef = useAccessibleMap(record);
    const mergedRef = useMergedRef(ref, accessibleRef);
    const next = accessibleRef === undefined ? record : { ...record, ref: mergedRef };

    return ELEMENTS[typeName]?.isLazy === true
        ? <LazyElement typeName={typeName} record={next} />
        : buildElement(typeName, next);
};

const renderElement = (typeName: string, props: unknown): ReactElement => {
    const record = isRecord(props) ? props : {};

    return <Element typeName={typeName} record={record} />;
};

/**
 * Builds the component that renders the element of a GLib type, which is how the generated `@gtkx/jsx`
 * store exposes every widget. Reach for it to render a type codegen does not cover, such as one
 * `registerClass` created: the element name is the GType name, and the component routes each prop whose
 * value is an element into that prop's slot, which a bare intrinsic element cannot do.
 *
 * Name the props the element takes as the type argument, since the GType name says nothing about them.
 * Left out, the component takes `unknown`, which accepts no attributes at all.
 *
 * @param typeName GType name to render, such as `GtkButton` or the `typeName` given to `registerClass`.
 * @param cls Wrapper class the name resolves to. Referencing it keeps the class, and with it the
 * registration the reconciler's name lookup depends on, in a tree-shaken bundle; the component
 * itself renders through the name.
 * @param metadata Registered metadata entry for the type. Referencing it keeps the type's property
 * and signal tables, which register themselves when evaluated, in a tree-shaken bundle.
 * @returns A component taking that type's props.
 */
/* eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- callers name the props */
const createElementComponent: <P = unknown>(
    typeName: string,
    cls?: unknown,
    metadata?: unknown,
) => (props: P) => ReactNode =
    (typeName) => (props): ReactNode => renderElement(typeName, props);

export { Prop, createElementComponent };
