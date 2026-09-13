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

export { setElementProps, elementPropTypeFor, type ElementProps };
