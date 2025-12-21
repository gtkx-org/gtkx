import type { Container, ContainerClass, Props } from "../../types.js";

export const isContainerType = (
    // biome-ignore lint/suspicious/noExplicitAny: ignore
    cls: new (...args: any[]) => Container,
    containerOrClass?: Container | ContainerClass,
): boolean => {
    if (!containerOrClass) {
        return false;
    }

    if (containerOrClass instanceof cls) {
        return true;
    }

    return containerOrClass === cls || Object.prototype.isPrototypeOf.call(cls, containerOrClass);
};

export const filterProps = (props: Props, excludeKeys: string[]): Props => {
    const result: Props = {};

    for (const key of Object.keys(props)) {
        if (!excludeKeys.includes(key)) {
            result[key] = props[key];
        }
    }

    return result;
};
