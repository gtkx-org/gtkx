import type { ElementPropsExport } from "@gtkx/react/config";

type ElementPropTypeRef = ElementPropsExport & { type: string };
type ElementProps = Record<string, ElementPropsExport>;

const elementProps: Map<string, ElementPropsExport> = new Map();

const setElementProps = (props: ElementProps): void => {
    elementProps.clear();

    for (const [glibName, ref] of Object.entries(props)) {
        elementProps.set(glibName, ref);
    }
};

const elementPropTypeFor = (glibName: string): ElementPropTypeRef | undefined => {
    const ref = elementProps.get(glibName);

    return ref === undefined ? undefined : { type: glibName, ...ref };
};

const factoryElementPropTypeFor = (glibName: string): ElementPropTypeRef | undefined => {
    const props = elementPropTypeFor(glibName);

    return props?.composition === "factory" ? props : undefined;
};

const elementBasePropTypeFor = (glibName: string): ElementPropTypeRef | undefined => {
    const props = elementPropTypeFor(glibName);

    return props?.composition === "factory" ? undefined : props;
};

const isInheritedFactoryProps = (
    glibName: string,
    ancestor: string,
    props: ElementPropsExport | undefined,
): boolean => ancestor !== glibName && props?.composition === "factory";

const collectConfiguredConstructOnlyProps = (
    glibNames: Iterable<string>,
    shouldSkip: (ancestor: string, props: ElementPropsExport | undefined) => boolean,
): string[] => {
    const names: Set<string> = new Set();

    for (const ancestor of glibNames) {
        const props = elementProps.get(ancestor);

        if (shouldSkip(ancestor, props)) {
            continue;
        }

        const constructOnly = props?.constructOnly ?? [];

        for (const name of constructOnly) {
            names.add(name);
        }
    }

    return [...names];
};

const configuredConstructOnlyPropsFor = (glibName: string, glibNames: Iterable<string>): string[] =>
    collectConfiguredConstructOnlyProps(glibNames, (ancestor, props) =>
        isInheritedFactoryProps(glibName, ancestor, props));

const inheritableConfiguredConstructOnlyPropsFor = (glibNames: Iterable<string>): string[] =>
    collectConfiguredConstructOnlyProps(glibNames, (_ancestor, props) => props?.composition === "factory");

export {
    setElementProps,
    elementPropTypeFor,
    factoryElementPropTypeFor,
    elementBasePropTypeFor,
    configuredConstructOnlyPropsFor,
    inheritableConfiguredConstructOnlyPropsFor,
    type ElementProps,
};
