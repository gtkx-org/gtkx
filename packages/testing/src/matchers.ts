/// <reference types="@vitest/expect" />
import * as Gtk from "@gtkx/gi/gtk";
import {
    getWidgetAccessibleName,
    getWidgetCheckedState,
    getWidgetDisplayValue,
    getWidgetExpandedState,
    getWidgetNodeText,
    getWidgetPlaceholderText,
    getWidgetPressedState,
    getWidgetSelectedState,
    getWidgetValue,
} from "./widget-accessible-properties.js";

/** The expected value for a text matcher: an exact string or a regular expression. */
export type TextExpectation = string | RegExp;

type MatcherResult = { pass: boolean; message: () => string };

interface MatcherContext {
    isNot: boolean;
}

type TextMatcher = (this: MatcherContext, received: unknown, expected?: TextExpectation) => MatcherResult;
type StateMatcher = (this: MatcherContext, received: unknown) => MatcherResult;
type ValueMatcher = (this: MatcherContext, received: unknown, expected: number) => MatcherResult;

const asWidget = (received: unknown, matcherName: string): Gtk.Widget => {
    if (!(received instanceof Gtk.Widget)) {
        throw new TypeError(`${matcherName}: received value must be a Gtk.Widget, got ${typeof received}`);
    }
    return received;
};

const describeWidget = (widget: Gtk.Widget): string => {
    const role = Gtk.AccessibleRole[widget.getAccessibleRole()];
    const name = getWidgetAccessibleName(widget);
    return name !== null ? `<${role} name=${JSON.stringify(name)}>` : `<${role}>`;
};

const matchesText = (actual: string, expected: TextExpectation, mode: "exact" | "substring"): boolean => {
    if (expected instanceof RegExp) {
        expected.lastIndex = 0;
        return expected.test(actual);
    }
    return mode === "exact" ? actual === expected : actual.includes(expected);
};

const describeExpected = (expected: TextExpectation): string =>
    expected instanceof RegExp ? String(expected) : JSON.stringify(expected);

const textMatcher = (
    matcherName: string,
    read: (widget: Gtk.Widget) => string | null,
    mode: "exact" | "substring",
): TextMatcher =>
    function (this: MatcherContext, received: unknown, expected?: TextExpectation): MatcherResult {
        const widget = asWidget(received, matcherName);
        const actual = read(widget);

        if (expected === undefined) {
            const pass = actual !== null && actual !== "";
            return {
                pass,
                message: () =>
                    `expected widget ${this.isNot ? "not " : ""}to have a non-empty value for ${matcherName}, ` +
                    `but got ${JSON.stringify(actual)}\n${describeWidget(widget)}`,
            };
        }

        const pass = actual !== null && matchesText(actual, expected, mode);
        return {
            pass,
            message: () =>
                `expected widget ${this.isNot ? "not " : ""}${matcherName} ${describeExpected(expected)}, ` +
                `but received ${JSON.stringify(actual)}\n${describeWidget(widget)}`,
        };
    };

const booleanStateMatcher = (
    matcherName: string,
    stateName: string,
    read: (widget: Gtk.Widget) => boolean | null,
): StateMatcher =>
    function (this: MatcherContext, received: unknown): MatcherResult {
        const widget = asWidget(received, matcherName);
        const state = read(widget);
        if (state === null) {
            throw new Error(
                `${matcherName}: widget does not expose a ${stateName} state ` +
                    `(role ${Gtk.AccessibleRole[widget.getAccessibleRole()]})\n${describeWidget(widget)}`,
            );
        }
        return {
            pass: state,
            message: () => `expected widget ${this.isNot ? "not " : ""}to be ${stateName}\n${describeWidget(widget)}`,
        };
    };

export const toHaveDisplayValue: TextMatcher = textMatcher("toHaveDisplayValue", getWidgetDisplayValue, "exact");
export const toHaveTextContent: TextMatcher = textMatcher(
    "toHaveTextContent",
    (widget) => getWidgetNodeText(widget) ?? getWidgetAccessibleName(widget),
    "substring",
);
export const toHaveAccessibleName: TextMatcher = textMatcher("toHaveAccessibleName", getWidgetAccessibleName, "exact");
export const toHavePlaceholderText: TextMatcher = textMatcher(
    "toHavePlaceholderText",
    getWidgetPlaceholderText,
    "exact",
);

export const toBeChecked: StateMatcher = booleanStateMatcher("toBeChecked", "checked", getWidgetCheckedState);
export const toBePressed: StateMatcher = booleanStateMatcher("toBePressed", "pressed", getWidgetPressedState);
export const toBeExpanded: StateMatcher = booleanStateMatcher("toBeExpanded", "expanded", getWidgetExpandedState);
export const toBeSelected: StateMatcher = booleanStateMatcher("toBeSelected", "selected", getWidgetSelectedState);

export const toHaveValue: ValueMatcher = function (
    this: MatcherContext,
    received: unknown,
    expected: number,
): MatcherResult {
    const widget = asWidget(received, "toHaveValue");
    const actual = getWidgetValue(widget).now;
    if (actual === null) {
        throw new Error(
            `toHaveValue: widget does not expose a numeric value ` +
                `(role ${Gtk.AccessibleRole[widget.getAccessibleRole()]})\n${describeWidget(widget)}`,
        );
    }
    return {
        pass: actual === expected,
        message: () =>
            `expected widget ${this.isNot ? "not " : ""}to have value ${expected}, but received ${actual}\n${describeWidget(widget)}`,
    };
};

interface MatcherImplementations {
    toHaveDisplayValue: TextMatcher;
    toHaveTextContent: TextMatcher;
    toHaveAccessibleName: TextMatcher;
    toHavePlaceholderText: TextMatcher;
    toBeChecked: StateMatcher;
    toBePressed: StateMatcher;
    toBeExpanded: StateMatcher;
    toBeSelected: StateMatcher;
    toHaveValue: ValueMatcher;
}

/** The widget assertion matchers keyed by name, suitable for passing to `expect.extend`. */
export const matchers: MatcherImplementations = {
    toHaveDisplayValue,
    toHaveTextContent,
    toHaveAccessibleName,
    toHavePlaceholderText,
    toBeChecked,
    toBePressed,
    toBeExpanded,
    toBeSelected,
    toHaveValue,
};

type ExpectExtend = { extend: (m: MatcherImplementations) => void };

const globalExpect = (): ExpectExtend | null => {
    const candidate: unknown = Reflect.get(globalThis, "expect");
    if (candidate && typeof (candidate as ExpectExtend).extend === "function") {
        return candidate as ExpectExtend;
    }
    return null;
};

let registered = false;

/** Registers the widget matchers on the global `expect`, when one is available. Safe to call more than once. */
export const registerMatchers = (): void => {
    if (registered) return;
    const expect = globalExpect();
    if (!expect) return;
    expect.extend(matchers);
    registered = true;
};

interface WidgetMatchers<R = void> {
    toHaveDisplayValue(expected?: TextExpectation): R;
    toHaveTextContent(expected?: TextExpectation): R;
    toHaveAccessibleName(expected?: TextExpectation): R;
    toHavePlaceholderText(expected?: TextExpectation): R;
    toBeChecked(): R;
    toBePressed(): R;
    toBeExpanded(): R;
    toBeSelected(): R;
    toHaveValue(expected: number): R;
}

declare module "@vitest/expect" {
    // biome-ignore lint/suspicious/noExplicitAny: must match the `Assertion<T>` signature it augments for declaration merging
    interface Assertion<T = any> extends WidgetMatchers {}
    interface AsymmetricMatchersContaining extends WidgetMatchers {}
}
