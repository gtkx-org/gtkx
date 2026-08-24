import type * as GObject from "@gtkx/gi/gobject";
import { isRecord } from "@gtkx/utils";
import {
    createElement,
    type ElementType,
    isValidElement,
    type ReactElement,
    type ReactNode,
    type Ref,
    useImperativeHandle,
    useMemo,
    useState,
} from "react";
import { createLazyPublicInstanceChannel, LAZY_PUBLIC_INSTANCE_PROP } from "../reconciler/lazy-public-instance.js";
import { ELEMENTS, type Props } from "../reconciler/registry.js";

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

const buildElement = (
    typeName: string,
    record: Props,
    channel: ReturnType<typeof createLazyPublicInstanceChannel> | null,
): ReactElement => {
    const Host = typeName as ElementType;
    const propChildren = collectPropChildren(record);
    const hostProps = propChildren === null ? record : hostPropsWithout(record);

    const props = channel === null
        ? hostProps
        : { ...hostProps, ref: undefined, [LAZY_PUBLIC_INSTANCE_PROP]: channel };

    return (
        <Host {...props}>
            {propChildren ?? NO_PROP_CHILDREN}
            {record.children as ReactNode}
        </Host>
    );
};

const useLazyPublicInstance = (
    ref: Ref<GObject.Object> | undefined,
): ReturnType<typeof createLazyPublicInstanceChannel> => {
    const [instance, setInstance] = useState<GObject.Object | null>(null);
    const channel = useMemo(() => createLazyPublicInstanceChannel(setInstance), []);
    const publicRef = instance === null ? undefined : ref;

    useImperativeHandle(publicRef, () => {
        if (instance === null) {
            throw new Error("A lazy public instance must exist while its ref is attached");
        }

        return instance;
    }, [instance]);

    return channel;
};

const createRegularElementComponent = (typeName: string): ((props: unknown) => ReactNode) =>
    (props: unknown): ReactNode => buildElement(typeName, isRecord(props) ? props : {}, null);

const createLazyElementComponent = (typeName: string): ((props: unknown) => ReactNode) =>
    (props: unknown): ReactNode => {
        const record: Props = isRecord(props) ? props : {};
        const ref = record.ref as Ref<GObject.Object> | undefined;
        const channel = useLazyPublicInstance(ref);

        return buildElement(typeName, record, channel);
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
 * @returns A component taking that type's props.
 */
/* eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- callers name the props */
function createElementComponent<P = unknown>(typeName: string): (props: P) => ReactNode {
    return ELEMENTS[typeName]?.isLazy === true
        ? createLazyElementComponent(typeName)
        : createRegularElementComponent(typeName);
}

export { Prop, createElementComponent };
