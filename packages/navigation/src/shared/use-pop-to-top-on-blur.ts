import type { NavigationHelpers, NavigationState, ParamListBase } from "@react-navigation/core";
import { StackActions } from "@react-navigation/core";
import { useEffect, useRef } from "react";

type BlurOptions = { popToTopOnBlur?: boolean };
type BlurDescriptors = Record<string, { options: BlurOptions }>;

const nestedStackKey = (state: NavigationState, routeKey: string): string | null => {
    const nested = state.routes.find((route) => route.key === routeKey)?.state;

    if (nested?.type === "stack" && typeof nested.key === "string") {
        return nested.key;
    }

    return null;
};

const popToTopTarget = (state: NavigationState, descriptors: BlurDescriptors, blurredKey: string): string | null =>
    descriptors[blurredKey]?.options.popToTopOnBlur === true ? nestedStackKey(state, blurredKey) : null;

const usePopToTopOnBlur = (
    state: NavigationState,
    descriptors: BlurDescriptors,
    navigation: NavigationHelpers<ParamListBase>,
): void => {
    const focusedKey = state.routes[state.index]?.key;
    const previousKeyRef = useRef(focusedKey);

    useEffect(() => {
        const previousKey = previousKeyRef.current;
        previousKeyRef.current = focusedKey;

        if (previousKey === undefined || previousKey === focusedKey) {
            return;
        }

        const target = popToTopTarget(state, descriptors, previousKey);

        if (target !== null) {
            navigation.dispatch({ ...StackActions.popToTop(), target });
        }
    }, [focusedKey, descriptors, navigation, state]);
};

export { usePopToTopOnBlur };
