/** Props interface a generated element's props extend, declared by hand in `@gtkx/react`. */
type ElementPropTypeRef = { type: string; module: string; export: string };
/** Base props interface each element extends, keyed by GLib type name (the module exports it). */
type ElementProps = Record<string, { module: string; export: string }>;

let elementProps: ElementProps = {};

/** Installs the base props each element extends (GLib type name → `{ module, export }`); set once per run. */
const setElementProps = (props: ElementProps): void => {
    elementProps = props;
};

/** The base props interface an element extends, when its element config declares one. */
const elementPropTypeFor = (glibName: string): ElementPropTypeRef | undefined => {
    const ref = elementProps[glibName];
    return ref === undefined ? undefined : { type: glibName, module: ref.module, export: ref.export };
};

export { setElementProps, elementPropTypeFor, type ElementPropTypeRef, type ElementProps };
