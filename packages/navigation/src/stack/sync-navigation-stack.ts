import * as Adw from "@gtkx/gi/adw";
import { StackActions } from "@react-navigation/core";
import type { StackNavigationHelpers, StackNavigationOptions } from "./types.js";

type OptionsByKey = Readonly<Record<string, StackNavigationOptions | undefined>>;

const readNavigationStack = (view: Adw.NavigationView): string[] => {
    const model = view.getNavigationStack();
    const count = model.getNItems();
    const tags: string[] = [];

    for (let index = 0; index < count; index += 1) {
        const page = model.getItem(index);
        const tag = page instanceof Adw.NavigationPage ? page.getTag() : null;

        if (tag !== null) {
            tags.push(tag);
        }
    }

    return tags;
};

const isSameStack = (left: readonly string[], right: readonly string[]): boolean =>
    left.length === right.length && left.every((tag, index) => right[index] === tag);

const isStrictPrefix = (prefix: readonly string[], list: readonly string[]): boolean =>
    prefix.length < list.length && prefix.every((tag, index) => list[index] === tag);

const isAnimated = (options: OptionsByKey, key: string | undefined): boolean =>
    key === undefined || options[key]?.animation !== "none";

const pushOnto = (
    view: Adw.NavigationView,
    current: readonly string[],
    desired: readonly string[],
    options: OptionsByKey,
): void => {
    const base = desired.slice(0, -1);
    const last = desired.at(-1);

    if (!isSameStack(base, current)) {
        view.replaceWithTags(base);
    }

    if (last !== undefined) {
        view.setAnimateTransitions(isAnimated(options, last));
        view.pushByTag(last);
    }
};

const applyStackChange = (
    view: Adw.NavigationView,
    current: readonly string[],
    desired: readonly string[],
    options: OptionsByKey,
): void => {
    const last = desired.at(-1);

    if (last !== undefined && isStrictPrefix(desired, current)) {
        view.setAnimateTransitions(isAnimated(options, current.at(-1)));
        view.popToTag(last);
    } else if (isStrictPrefix(current, desired)) {
        pushOnto(view, current, desired, options);
    } else {
        view.replaceWithTags([...desired]);
    }
};

const syncNavigationStack = (
    view: Adw.NavigationView,
    desired: readonly string[],
    options: OptionsByKey,
    isInitial: boolean,
): void => {
    const current = readNavigationStack(view);

    if (!isSameStack(current, desired)) {
        if (isInitial) {
            view.replaceWithTags([...desired]);
        } else {
            applyStackChange(view, current, desired, options);
        }
    }

    view.setAnimateTransitions(isAnimated(options, desired.at(-1)));
};

const routeKeys = (state: { routes: readonly { key: string }[] }, offset: number): string[] =>
    state.routes.slice(offset).map((route) => route.key);

const popToActualStack = (
    navigation: StackNavigationHelpers,
    actual: readonly string[],
    desired: readonly string[],
): void => {
    const state = navigation.getState();
    navigation.dispatch({ ...StackActions.pop(desired.length - actual.length), target: state.key });
};

const reconcilePoppedStack = (
    view: Adw.NavigationView,
    navigation: StackNavigationHelpers,
    options: OptionsByKey,
    offset: number,
): void => {
    const actual = readNavigationStack(view);
    const desired = routeKeys(navigation.getState(), offset);

    if (isStrictPrefix(actual, desired)) {
        popToActualStack(navigation, actual, desired);
    }

    syncNavigationStack(view, routeKeys(navigation.getState(), offset), options, false);
};

export { type OptionsByKey, reconcilePoppedStack, syncNavigationStack };
