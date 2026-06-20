import { getIsReactActEnvironment, setIsReactActEnvironment } from "@gtkx/testing/act";
import { afterEach, beforeEach } from "vitest";

export const setupRealRenderEnvironment = (): void => {
    let previousActEnvironment: boolean | undefined;

    beforeEach(() => {
        previousActEnvironment = getIsReactActEnvironment();
        setIsReactActEnvironment(false);
    });

    afterEach(() => {
        setIsReactActEnvironment(previousActEnvironment);
    });
};
