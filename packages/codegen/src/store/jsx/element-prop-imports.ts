/** Props interface a generated element's props extend, declared by hand in `@gtkx/react`. */
export type ElementPropTypeRef = { type: string; module: string; export: string };

let propInterfaces: Record<string, string> = {};

/** Installs the `@gtkx/react` prop-interface surface (`${element}Props` name → module); set once per run. */
export const setPropInterfaces = (interfaces: Record<string, string>): void => {
    propInterfaces = interfaces;
};

/**
 * The hand-declared props interface an element extends, if `@gtkx/react` (or a namespace extension)
 * exports one named `${glibName}Props`.
 */
export const elementPropTypeFor = (glibName: string): ElementPropTypeRef | undefined => {
    const exportName = `${glibName}Props`;
    const module = propInterfaces[exportName];
    return module === undefined ? undefined : { type: glibName, module, export: exportName };
};
