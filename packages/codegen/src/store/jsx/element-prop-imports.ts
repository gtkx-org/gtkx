/** Props interface a generated element's props extend, declared by hand in `@gtkx/react`. */
export type ElementPropTypeRef = { type: string; module: string; export: string };

/** Base props interface each element extends, keyed by GLib type name (the module exports it). */
export type ElementProps = Record<string, { module: string; export: string }>;

let elementProps: ElementProps = {};

/** Installs the base props each element extends (GLib type name → `{ module, export }`); set once per run. */
export const setElementProps = (props: ElementProps): void => {
    elementProps = props;
};

/** The base props interface an element extends, when its element config declares one. */
export const elementPropTypeFor = (glibName: string): ElementPropTypeRef | undefined => {
    const ref = elementProps[glibName];
    return ref === undefined ? undefined : { type: glibName, module: ref.module, export: ref.export };
};
