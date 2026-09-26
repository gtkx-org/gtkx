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
 * Creates a JSX component for a GType, including custom types created with `registerClass`.
 * Generated JSX uses this factory to route element-valued props into named child slots,
 * which bare intrinsic elements cannot do.
 *
 * Supply the props type as the type argument. It cannot be inferred from the GType name;
 * the default `unknown` accepts no attributes.
 *
 * @param typeName GType name, such as `GtkButton` or a custom `registerClass` type name.
 * @param cls Wrapper class to retain with its registration during tree shaking. Rendering
 * uses `typeName` for lookup.
 * @returns A component accepting the specified props.
 */
/* eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- callers name the props */
const createElementComponent: <P = unknown>(
    typeName: string,
    cls?: unknown,
) => (props: P) => ReactNode =
    (typeName) => (props): ReactNode => renderElement(typeName, props);

export { Prop, createElementComponent };
