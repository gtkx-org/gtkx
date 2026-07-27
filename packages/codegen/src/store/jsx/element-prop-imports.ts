/** Props interface a generated element's props extend, declared by hand in `@gtkx/react`. */
type ElementPropTypeRef = { type: string; module: string; export: string };
/** Base props interface each element extends, keyed by GLib type name (the module exports it). */
type ElementProps = Record<string, { module: string; export: string }>;

const elementProps: Map<string, { module: string; export: string }> = new Map();

/** Installs the base props each element extends (GLib type name → `{ module, export }`); set once per run. */
const setElementProps = (props: ElementProps): void => {
    elementProps.clear();

    for (const [glibName, ref] of Object.entries(props)) {
        elementProps.set(glibName, ref);
    }
};

/** The base props interface an element extends, when its element config declares one. */
const elementPropTypeFor = (glibName: string): ElementPropTypeRef | undefined => {
    const ref = elementProps.get(glibName);

    return ref === undefined ? undefined : { type: glibName, module: ref.module, export: ref.export };
};

export { setElementProps, elementPropTypeFor, type ElementPropTypeRef, type ElementProps };
