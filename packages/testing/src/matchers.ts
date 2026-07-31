/// <reference types="@vitest/expect" />
import * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { formatRole } from "./role-helpers.js";
import {
    type CheckedState,
    getWidgetAccessibleName,
    getWidgetCheckedState,
    getWidgetDescribedByText,
    getWidgetDisplayValue,
    getWidgetErrorMessage,
    getWidgetExpandedState,
    getWidgetInvalidState,
    getWidgetLabelText,
    getWidgetPlaceholderText,
    getWidgetPressedState,
    getWidgetRequiredState,
    getWidgetSelectedState,
    getWidgetSelection,
    getWidgetTextContent,
    getWidgetValue,
    hasDisplayValue,
    isWidgetDisabled,
    isWidgetVisible,
} from "./widget-accessible-properties.js";

/** The expected value for a text matcher: an exact string or a regular expression. */
type TextExpectation = string | RegExp;
/** The expected value for a style class: an exact class name or a regular expression. */
type ClassExpectation = string | RegExp;
type MatcherResult = { pass: boolean; message: () => string };
type MatcherContext = { equals: (actual: unknown, expected: unknown) => boolean };
type TextMatcher = (received: unknown, expected?: TextExpectation) => MatcherResult;
type StateMatcher = (received: unknown) => MatcherResult;
type TextMatcherContext = { matcherName: string; widget: Gtk.Widget; actual: string | null };
type ClassArguments = { expected: ClassExpectation[]; isExact: boolean };

type MatcherImplementations = {
    toHaveDisplayValue: TextMatcher;
    toHaveTextContent: TextMatcher;
    toHaveAccessibleName: TextMatcher;
    toHaveAccessibleDescription: TextMatcher;
    toHaveAccessibleErrorMessage: TextMatcher;
    toHavePlaceholderText: TextMatcher;
    toHaveSelection: TextMatcher;
    toBeChecked: StateMatcher;
    toBePartiallyChecked: StateMatcher;
    toBePressed: StateMatcher;
    toBeExpanded: StateMatcher;
    toBeSelected: StateMatcher;
    toBeDisabled: StateMatcher;
    toBeEnabled: StateMatcher;
    toBeVisible: StateMatcher;
    toBeRooted: StateMatcher;
    toBeEmpty: StateMatcher;
    toBeInvalid: StateMatcher;
    toBeValid: StateMatcher;
    toBeRequired: StateMatcher;
    toHaveFocus: StateMatcher;
    toHaveValue: (received: unknown, expected?: number | string) => MatcherResult;
    toHaveRole: (received: unknown, expected: Gtk.AccessibleRole) => MatcherResult;
    toContainElement: (received: unknown, descendant: Gtk.Widget | null) => MatcherResult;
    toHaveClass: (received: unknown, ...args: unknown[]) => MatcherResult;
    toHaveObjectProperty: (this: MatcherContext, received: unknown, ...args: unknown[]) => MatcherResult;
};

type ExpectExtend = { extend: (m: MatcherImplementations) => void };

const registration = { isRegistered: false };
const displayValueMatcher: TextMatcher = textMatcher("toHaveDisplayValue", getWidgetDisplayValue, "exact");
const toHaveTextContent: TextMatcher = textMatcher("toHaveTextContent", getWidgetTextContent, "substring");
const toHaveAccessibleName: TextMatcher = textMatcher("toHaveAccessibleName", getWidgetAccessibleName, "exact");

const toHaveAccessibleDescription: TextMatcher = textMatcher(
    "toHaveAccessibleDescription",
    getWidgetDescribedByText,
    "exact",
);

const toHaveAccessibleErrorMessage: TextMatcher = textMatcher(
    "toHaveAccessibleErrorMessage",
    readErrorMessageText,
    "exact",
);

const toHavePlaceholderText: TextMatcher = textMatcher("toHavePlaceholderText", getWidgetPlaceholderText, "exact");
const toHaveSelection: TextMatcher = textMatcher("toHaveSelection", getWidgetSelection, "exact");
const toBePressed: StateMatcher = booleanStateMatcher("toBePressed", "pressed", getWidgetPressedState);
const toBeExpanded: StateMatcher = booleanStateMatcher("toBeExpanded", "expanded", getWidgetExpandedState);
const toBeSelected: StateMatcher = booleanStateMatcher("toBeSelected", "selected", getWidgetSelectedState);
const toBeRequired: StateMatcher = booleanStateMatcher("toBeRequired", "required", getWidgetRequiredState);

/** The widget assertion matchers keyed by name, suitable for passing to `expect.extend`. */
const matchers: MatcherImplementations = {
    toHaveDisplayValue,
    toHaveTextContent,
    toHaveAccessibleName,
    toHaveAccessibleDescription,
    toHaveAccessibleErrorMessage,
    toHavePlaceholderText,
    toHaveSelection,
    toBeChecked,
    toBePartiallyChecked,
    toBePressed,
    toBeExpanded,
    toBeSelected,
    toBeDisabled,
    toBeEnabled,
    toBeVisible,
    toBeRooted,
    toBeEmpty,
    toBeInvalid,
    toBeValid,
    toBeRequired,
    toHaveFocus,
    toHaveValue,
    toHaveRole,
    toContainElement,
    toHaveClass,
    toHaveObjectProperty,
};

const asWidget = (received: unknown, matcherName: string): Gtk.Widget => {
    if (!(received instanceof Gtk.Widget)) {
        throw new TypeError(`${matcherName}: received value must be a Gtk.Widget, got ${typeof received}`);
    }

    return received;
};

const asObject = (received: unknown, matcherName: string): GObject.Object => {
    if (!(received instanceof GObject.Object)) {
        throw new TypeError(`${matcherName}: received value must be a GObject, got ${typeof received}`);
    }

    return received;
};

const describeWidget = (widget: Gtk.Widget): string => {
    const role = Gtk.AccessibleRole[widget.getAccessibleRole()];
    const name = getWidgetAccessibleName(widget);

    return name === null ? `<${role}>` : `<${role} name=${JSON.stringify(name)}>`;
};

const describeObject = (object: GObject.Object): string =>
    object instanceof Gtk.Widget ? describeWidget(object) : `<${object.constructor.name}>`;

const isTextMatch = (actual: string, expected: TextExpectation, mode: "exact" | "substring"): boolean => {
    if (expected instanceof RegExp) {
        expected.lastIndex = 0;

        return expected.test(actual);
    }

    return mode === "exact" ? actual === expected : actual.includes(expected);
};

const describeExpected = (expected: TextExpectation): string =>
    expected instanceof RegExp ? String(expected) : JSON.stringify(expected);

const negationPrefix = (isPass: boolean): string => (isPass ? "not " : "");

const nonEmptyResult = ({ matcherName, widget, actual }: TextMatcherContext): MatcherResult => {
    const isPass = actual !== null && actual !== "";

    return {
        pass: isPass,
        message: () =>
            `expected widget ${negationPrefix(isPass)}to have a non-empty value for ${matcherName}, ` +
            `but got ${JSON.stringify(actual)}\n${describeWidget(widget)}`,
    };
};

const matchedResult = (context: TextMatcherContext, expected: TextExpectation, isPass: boolean): MatcherResult => ({
    pass: isPass,
    message: () =>
        `expected widget ${negationPrefix(isPass)}${context.matcherName} ${describeExpected(expected)}, ` +
        `but received ${JSON.stringify(context.actual)}\n${describeWidget(context.widget)}`,
});

const stateResult = (widget: Gtk.Widget, stateName: string, isPass: boolean): MatcherResult => ({
    pass: isPass,
    message: () => `expected widget ${negationPrefix(isPass)}to be ${stateName}\n${describeWidget(widget)}`,
});

const camelCase = (name: string): string =>
    name.replaceAll(/-([a-z])/g, (_match, letter: string) => letter.toUpperCase());

const isAsymmetricMatcher = (value: unknown): boolean =>
    typeof value === "object" && value !== null && typeof Reflect.get(value, "asymmetricMatch") === "function";

const isEqualValue = (context: MatcherContext, actual: unknown, expected: unknown): boolean => {
    if (isAsymmetricMatcher(expected)) {
        return context.equals(actual, expected);
    }

    if (actual instanceof GObject.Object || expected instanceof GObject.Object) {
        return Object.is(actual, expected);
    }

    return context.equals(actual, expected);
};

const isClassMatch = (actual: string[], expected: ClassExpectation): boolean =>
    expected instanceof RegExp ? actual.some((name) => expected.test(name)) : actual.includes(expected);

const isWidgetRooted = (widget: Gtk.Widget): boolean => {
    const root = widget.getRoot();

    if (root === null) {
        return false;
    }

    if (root instanceof Gtk.Window) {
        return Gtk.Window.listToplevels().includes(root);
    }

    return true;
};

const globalExpect = (): ExpectExtend | null => {
    const candidate: unknown = Reflect.get(globalThis, "expect");

    if (candidate && typeof (candidate as ExpectExtend).extend === "function") {
        return candidate as ExpectExtend;
    }

    return null;
};

function readErrorMessageText(widget: Gtk.Widget): string | null {
    const state = getWidgetInvalidState(widget);

    if (state === null || state === Gtk.AccessibleInvalidState.FALSE) {
        return null;
    }

    const targets = getWidgetErrorMessage(widget);

    if (targets === null) {
        return null;
    }

    const texts = targets.map((target) => getWidgetAccessibleName(target)).filter((text) => text !== null);

    return texts.length > 0 ? texts.join(" ") : null;
}

function assertReadableProperty(object: GObject.Object, name: string, property: string, value: unknown): void {
    if (typeof value === "function") {
        throw new TypeError(
            `toHaveObjectProperty: "${name}" is shadowed by a method of the same name; ` +
            `call ${property}() and assert on its result instead`,
        );
    }

    if (value === undefined && !Reflect.has(object, property)) {
        throw new TypeError(
            `toHaveObjectProperty: no readable property "${name}" on ${describeObject(object)}; ` +
            "construct-only and write-only properties cannot be read back",
        );
    }
}

function readObjectProperty(object: GObject.Object, name: string): unknown {
    const property = camelCase(name);
    const value: unknown = Reflect.get(object, property);
    assertReadableProperty(object, name, property, value);

    return value;
}

function classEntries(entry: unknown): ClassExpectation[] {
    return entry instanceof RegExp ? [entry] : String(entry).split(/\s+/).filter(Boolean);
}

function parseClassArguments(args: unknown[]): ClassArguments {
    const last = args.at(-1);
    const isOptions = typeof last === "object" && last !== null && !(last instanceof RegExp);
    const isExact = isOptions && Reflect.get(last, "exact") === true;
    const entries = isOptions ? args.slice(0, -1) : args;

    return { expected: entries.flatMap((entry) => classEntries(entry)), isExact };
}

function exactClassResult(widget: Gtk.Widget, actual: string[], expected: ClassExpectation[]): MatcherResult {
    if (expected.some((entry) => entry instanceof RegExp)) {
        throw new TypeError("toHaveClass: the exact option cannot be combined with a regular expression");
    }

    const names = expected.map(String);
    const isPass = names.length === actual.length && names.every((name) => actual.includes(name));

    return {
        pass: isPass,
        message: () =>
            `expected widget ${negationPrefix(isPass)}to have exactly the classes ${JSON.stringify(names)}, ` +
            `but received ${JSON.stringify(actual)}\n${describeWidget(widget)}`,
    };
}

function textMatcher(
    matcherName: string,
    read: (widget: Gtk.Widget) => string | null,
    mode: "exact" | "substring",
): TextMatcher {
    return (received: unknown, expected?: TextExpectation): MatcherResult => {
        const widget = asWidget(received, matcherName);
        const actual = read(widget);
        const context: TextMatcherContext = { matcherName, widget, actual };

        if (expected === undefined) {
            return nonEmptyResult(context);
        }

        return matchedResult(context, expected, actual !== null && isTextMatch(actual, expected, mode));
    };
}

function notApplicable(matcherName: string, stateName: string, widget: Gtk.Widget): Error {
    return new Error(
        `${matcherName}: widget does not expose a ${stateName} ` +
        `(role ${Gtk.AccessibleRole[widget.getAccessibleRole()]})\n${describeWidget(widget)}`,
    );
}

function booleanStateMatcher(
    matcherName: string,
    stateName: string,
    read: (widget: Gtk.Widget) => boolean | null,
): StateMatcher {
    return (received: unknown): MatcherResult => {
        const widget = asWidget(received, matcherName);
        const state = read(widget);

        if (state === null) {
            throw notApplicable(matcherName, `${stateName} state`, widget);
        }

        return stateResult(widget, stateName, state);
    };
}

function readCheckedState(widget: Gtk.Widget, matcherName: string): CheckedState {
    const state = getWidgetCheckedState(widget);

    if (state === null) {
        throw notApplicable(matcherName, "checked state", widget);
    }

    return state;
}

function toBeChecked(received: unknown): MatcherResult {
    const widget = asWidget(received, "toBeChecked");

    return stateResult(widget, "checked", readCheckedState(widget, "toBeChecked") === "checked");
}

function toBePartiallyChecked(received: unknown): MatcherResult {
    const widget = asWidget(received, "toBePartiallyChecked");

    return stateResult(widget, "partially checked", readCheckedState(widget, "toBePartiallyChecked") === "mixed");
}

function toHaveDisplayValue(received: unknown, expected?: TextExpectation): MatcherResult {
    const widget = asWidget(received, "toHaveDisplayValue");

    if (!hasDisplayValue(widget)) {
        throw notApplicable("toHaveDisplayValue", "display value", widget);
    }

    return displayValueMatcher(received, expected);
}

function toHaveValue(received: unknown, expected?: number | string): MatcherResult {
    const widget = asWidget(received, "toHaveValue");

    if (typeof expected === "string") {
        return displayValueMatcher(received, expected);
    }

    const actual = getWidgetValue(widget).now;

    if (actual === null) {
        throw notApplicable("toHaveValue", "numeric value", widget);
    }

    const isPass = expected === undefined || actual === expected;

    return {
        pass: isPass,
        message: () =>
            `expected widget ${negationPrefix(isPass)}to have value ${String(expected)}, ` +
            `but received ${String(actual)}\n${describeWidget(widget)}`,
    };
}

function toBeDisabled(received: unknown): MatcherResult {
    const widget = asWidget(received, "toBeDisabled");

    return stateResult(widget, "disabled", isWidgetDisabled(widget));
}

function toBeEnabled(received: unknown): MatcherResult {
    const widget = asWidget(received, "toBeEnabled");

    return stateResult(widget, "enabled", !isWidgetDisabled(widget));
}

function toBeVisible(received: unknown): MatcherResult {
    const widget = asWidget(received, "toBeVisible");

    return stateResult(widget, "visible", isWidgetVisible(widget));
}

function toBeRooted(received: unknown): MatcherResult {
    if (received === null) {
        return { pass: false, message: () => "expected a widget to be rooted in a window, but received null" };
    }

    const widget = asWidget(received, "toBeRooted");

    return stateResult(widget, "rooted in a window", isWidgetRooted(widget));
}

function toBeEmpty(received: unknown): MatcherResult {
    const widget = asWidget(received, "toBeEmpty");

    return stateResult(widget, "empty", widget.getFirstChild() === null && getWidgetLabelText(widget) === null);
}

function toBeInvalid(received: unknown): MatcherResult {
    const widget = asWidget(received, "toBeInvalid");
    const state = getWidgetInvalidState(widget);

    return stateResult(widget, "invalid", state !== null && state !== Gtk.AccessibleInvalidState.FALSE);
}

function toBeValid(received: unknown): MatcherResult {
    const widget = asWidget(received, "toBeValid");
    const state = getWidgetInvalidState(widget);

    return stateResult(widget, "valid", state === null || state === Gtk.AccessibleInvalidState.FALSE);
}

function toHaveFocus(received: unknown): MatcherResult {
    const widget = asWidget(received, "toHaveFocus");

    return stateResult(widget, "focused", widget.getPlatformState(Gtk.AccessiblePlatformState.FOCUSED));
}

function toHaveRole(received: unknown, expected: Gtk.AccessibleRole): MatcherResult {
    const widget = asWidget(received, "toHaveRole");
    const actual = widget.getAccessibleRole();
    const isPass = actual === expected;

    return {
        pass: isPass,
        message: () =>
            `expected widget ${negationPrefix(isPass)}to have role '${formatRole(expected)}', ` +
            `but received '${formatRole(actual)}'\n${describeWidget(widget)}`,
    };
}

function toContainElement(received: unknown, descendant: Gtk.Widget | null): MatcherResult {
    const widget = asWidget(received, "toContainElement");
    const isPass = descendant !== null && (descendant === widget || descendant.isAncestor(widget));

    return {
        pass: isPass,
        message: () =>
            `expected widget ${negationPrefix(isPass)}to contain ` +
            `${descendant === null ? "null" : describeWidget(descendant)}\n${describeWidget(widget)}`,
    };
}

function toHaveClass(received: unknown, ...args: unknown[]): MatcherResult {
    const widget = asWidget(received, "toHaveClass");
    const actual = widget.getCssClasses();
    const { expected, isExact } = parseClassArguments(args);

    if (isExact) {
        return exactClassResult(widget, actual, expected);
    }

    if (expected.length === 0) {
        return stateResult(widget, "given any style class", actual.length > 0);
    }

    const isPass = expected.every((entry) => isClassMatch(actual, entry));

    return {
        pass: isPass,
        message: () =>
            `expected widget ${negationPrefix(isPass)}to have class ${expected.map(String).join(", ")}, ` +
            `but received ${JSON.stringify(actual)}\n${describeWidget(widget)}`,
    };
}

function toHaveObjectProperty(this: MatcherContext, received: unknown, ...args: unknown[]): MatcherResult {
    const object = asObject(received, "toHaveObjectProperty");
    const [name, expected] = args;
    const actual = readObjectProperty(object, String(name));

    if (args.length < 2) {
        const isSet = actual !== null && actual !== undefined;

        return {
            pass: isSet,
            message: () =>
                `expected ${describeObject(object)} ${negationPrefix(isSet)}to have a value for property ` +
                `"${String(name)}", but received ${JSON.stringify(actual)}`,
        };
    }

    /* eslint-disable-next-line unicorn/no-this-outside-of-class --
       expect.extend invokes matchers with the matcher state as `this` */
    const isPass = isEqualValue(this, actual, expected);

    return {
        pass: isPass,
        message: () =>
            `expected ${describeObject(object)} ${negationPrefix(isPass)}to have property "${String(name)}" ` +
            `equal to ${JSON.stringify(expected)}, but received ${JSON.stringify(actual)}`,
    };
}

/** Registers the widget matchers on the global `expect`, when one is available. Safe to call more than once. */
const registerMatchers = (): void => {
    if (registration.isRegistered) {
        return;
    }

    const expect = globalExpect();

    if (!expect) {
        return;
    }

    expect.extend(matchers);
    registration.isRegistered = true;
};

declare module "@vitest/expect" {
    /* eslint-disable @typescript-eslint/consistent-type-definitions -- declaration merging requires interfaces */
    interface Assertion {
        toHaveDisplayValue(expected?: TextExpectation): void;
        toHaveTextContent(expected?: TextExpectation): void;
        toHaveAccessibleName(expected?: TextExpectation): void;
        toHaveAccessibleDescription(expected?: TextExpectation): void;
        toHaveAccessibleErrorMessage(expected?: TextExpectation): void;
        toHavePlaceholderText(expected?: TextExpectation): void;
        toHaveSelection(expected?: TextExpectation): void;
        toBeChecked(): void;
        toBePartiallyChecked(): void;
        toBePressed(): void;
        toBeExpanded(): void;
        toBeSelected(): void;
        toBeDisabled(): void;
        toBeEnabled(): void;
        toBeVisible(): void;
        toBeRooted(): void;
        toBeEmpty(): void;
        toBeInvalid(): void;
        toBeValid(): void;
        toBeRequired(): void;
        toHaveFocus(): void;
        toHaveValue(expected?: number | string): void;
        toHaveRole(expected: Gtk.AccessibleRole): void;
        toContainElement(descendant: Gtk.Widget | null): void;
        toHaveClass(...args: (ClassExpectation | { exact: boolean })[]): void;
        toHaveObjectProperty(name: string, expected?: unknown): void;
    }

    interface AsymmetricMatchersContaining {
        toHaveDisplayValue(expected?: TextExpectation): void;
        toHaveTextContent(expected?: TextExpectation): void;
        toHaveAccessibleName(expected?: TextExpectation): void;
        toHaveAccessibleDescription(expected?: TextExpectation): void;
        toHaveAccessibleErrorMessage(expected?: TextExpectation): void;
        toHavePlaceholderText(expected?: TextExpectation): void;
        toHaveSelection(expected?: TextExpectation): void;
        toBeChecked(): void;
        toBePartiallyChecked(): void;
        toBePressed(): void;
        toBeExpanded(): void;
        toBeSelected(): void;
        toBeDisabled(): void;
        toBeEnabled(): void;
        toBeVisible(): void;
        toBeRooted(): void;
        toBeEmpty(): void;
        toBeInvalid(): void;
        toBeValid(): void;
        toBeRequired(): void;
        toHaveFocus(): void;
        toHaveValue(expected?: number | string): void;
        toHaveRole(expected: Gtk.AccessibleRole): void;
        toContainElement(descendant: Gtk.Widget | null): void;
        toHaveClass(...args: (ClassExpectation | { exact: boolean })[]): void;
        toHaveObjectProperty(name: string, expected?: unknown): void;
    }
    /* eslint-enable @typescript-eslint/consistent-type-definitions */
}

export {
    toHaveDisplayValue,
    toHaveTextContent,
    toHaveAccessibleName,
    toHaveAccessibleDescription,
    toHaveAccessibleErrorMessage,
    toHavePlaceholderText,
    toHaveSelection,
    toBeChecked,
    toBePartiallyChecked,
    toBePressed,
    toBeExpanded,
    toBeSelected,
    toBeDisabled,
    toBeEnabled,
    toBeVisible,
    toBeRooted,
    toBeEmpty,
    toBeInvalid,
    toBeValid,
    toBeRequired,
    toHaveFocus,
    toHaveValue,
    toHaveRole,
    toContainElement,
    toHaveClass,
    toHaveObjectProperty,
    matchers,
    registerMatchers,
    type ClassExpectation,
    type TextExpectation,
};
