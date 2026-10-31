import { type ElementType, type ReactNode, type Ref, useLayoutEffect, useState } from "react";
import type { Props } from "../reconciler/registry.js";
import { useMergedRef } from "./use-merged-refs.js";

type PresentedProps<T> = {
    ref?: Ref<T | null> | undefined;
};

type PresentedOptions<T> = {
    usePresent: () => (instance: T) => void;
    dismiss: (instance: T) => void;
    wrap?: (element: ReactNode, instance: T | null) => ReactNode;
    useNativeProps?: (instance: T | null, props: Props) => Props;
};

const useRenderedProps = (_instance: unknown, props: Props): Props => props;

const usePresentedInstance = <T,>(
    ref: Ref<T | null> | undefined,
    present: (instance: T) => void,
    dismiss: (instance: T) => void,
): [T | null, Ref<T>] => {
    const [instance, setInstance] = useState<T | null>(null);
    const mergedRef = useMergedRef<T>(ref, setInstance);

    useLayoutEffect(() => {
        if (!instance) {
            return;
        }

        present(instance);

        return () => {
            dismiss(instance);
        };
    }, [instance, present, dismiss]);

    return [instance, mergedRef];
};

const createPresentedComponent = <T,>(
    Component: ElementType,
    options: PresentedOptions<T>,
): ((props: PresentedProps<T>) => ReactNode) => {
    const useNativeProps = options.useNativeProps ?? useRenderedProps;

    return ({ ref, ...rest }: PresentedProps<T>): ReactNode => {
        const present = options.usePresent();
        const [instance, mergedRef] = usePresentedInstance(ref, present, options.dismiss);
        const nativeProps = useNativeProps(instance, rest);
        const element = <Component ref={mergedRef} {...nativeProps} />;

        return options.wrap ? options.wrap(element, instance) : element;
    };
};

export { createPresentedComponent, type PresentedProps };
