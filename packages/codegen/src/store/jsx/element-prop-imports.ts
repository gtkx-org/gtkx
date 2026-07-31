type ElementPropTypeRef = { type: string; module: string; export: string };

/** Base props interface each element extends, keyed by GLib type name (the module exports it). */
type ElementProps = Record<string, {
    /** Specifier the props interface is imported from. */
    module: string;
    /** Identifier the module exports it under. */
    export: string;
}>;

const elementProps: Map<string, { module: string; export: string }> = new Map();

const setElementProps = (props: ElementProps): void => {
    elementProps.clear();

    for (const [glibName, ref] of Object.entries(props)) {
        elementProps.set(glibName, ref);
    }
};

const elementPropTypeFor = (glibName: string): ElementPropTypeRef | undefined => {
    const ref = elementProps.get(glibName);

    return ref === undefined ? undefined : { type: glibName, module: ref.module, export: ref.export };
};

export { setElementProps, elementPropTypeFor, type ElementPropTypeRef, type ElementProps };
