import type { SyncExpectationResult } from "@vitest/expect";
import * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import type { ByRoleOptions, Matcher, MatcherOptions } from "./types.js";
import {
    ACCESSIBLE_NUMBER_TOLERANCE,
    type AccessibleAttributeValue,
    isAccessibleNumberMatch,
    isAccessibleNumberProperty,
    readAccessibleProperty,
    readAccessibleState,
} from "./accessible-native.js";
import { getDefaultNormalizer } from "./normalize.js";
import {
    queryAllByDisplayValue,
    queryAllByLabelText,
    queryAllByPlaceholderText,
    queryAllByRole,
    queryAllByText,
} from "./queries.js";
import { formatRole } from "./role-helpers.js";
import { type Container, descendants } from "./traversal.js";
import {
    type CheckedState,
    getWidgetAccessibleName,
    getWidgetCheckedState,
    getWidgetDescribedByText,
    getWidgetDisplayValue,
    getWidgetErrorMessage,
    getWidgetInvalidState,
    getWidgetLabelText,
    getWidgetPressedState,
    getWidgetRequiredState,
    getWidgetSelection,
    getWidgetTextContent,
    getWidgetValueNow,
    hasDisplayValue,
    isWidgetDisabled,
    isWidgetValueMatch,
    isWidgetVisible,
} from "./widget-accessible-properties.js";
import { getTypeTag } from "./widget-getters.js";
import { isWindowActivated } from "./window-state.js";

/** The expected value for a text matcher: an exact string or a regular expression. */
type TextExpectation = string | RegExp;

/** Options controlling how `toHaveTextContent` normalizes the text it reads. */
type TextContentOptions = {
    /**
     * When true (the default), trim the text and collapse runs of whitespace into single spaces
     * before comparing. When false, only replace non-breaking spaces with regular ones.
     */
    normalizeWhitespace?: boolean | undefined;
};

/** The expected value for a style class: an exact class name or a regular expression. */
type ClassExpectation = string | RegExp;
/** The outcome of a matcher: whether it passed, and the failure text built on demand. */
type MatcherResult = Pick<SyncExpectationResult, "message" | "pass">;

/** The matcher state bound as `this`, supplying the test runner's deep equality check. */
type MatcherContext = {
    /** Compares a received value against an expected one, resolving asymmetric matchers. */
    equals: (actual: unknown, expected: unknown) => boolean;
};

/** Compares text read from the received widget; with no expected value, asserts the text is non-empty. */
type TextMatcher = (received: unknown, expected?: TextExpectation) => MatcherResult;
/** Asserts a single state of the received widget, taking no expected value. */
type StateMatcher = (received: unknown) => MatcherResult;
/** Trailing arguments of the `ByRole` query family, as a containment matcher takes them. */
type RoleQueryArgs = [role: Gtk.AccessibleRole, options?: ByRoleOptions];
/** Trailing arguments of the text-based query families, as a containment matcher takes them. */
type TextQueryArgs = [text: Matcher, options?: MatcherOptions];
/** Counts the descendants a query family finds under the received widget. */
type ContainmentMatcher<Args extends unknown[]> = (received: unknown, ...args: Args) => MatcherResult;
type TextMatcherContext = { matcherName: string; widget: Gtk.Widget; actual: string | null };
type ClassArguments = { expected: ClassExpectation[]; isExact: boolean };
type QueryAll<Args extends unknown[]> = (container: Container, ...args: Args) => Gtk.Widget[];

type BooleanAccessibleState =
    Gtk.AccessibleState.BUSY |
    Gtk.AccessibleState.DISABLED |
    Gtk.AccessibleState.EXPANDED |
    Gtk.AccessibleState.HIDDEN |
    Gtk.AccessibleState.SELECTED |
    Gtk.AccessibleState.VISITED;

type TristateAccessibleState = Gtk.AccessibleState.CHECKED | Gtk.AccessibleState.PRESSED;

type StringAccessibleProperty =
    Gtk.AccessibleProperty.DESCRIPTION |
    Gtk.AccessibleProperty.HELP_TEXT |
    Gtk.AccessibleProperty.KEY_SHORTCUTS |
    Gtk.AccessibleProperty.LABEL |
    Gtk.AccessibleProperty.PLACEHOLDER |
    Gtk.AccessibleProperty.ROLE_DESCRIPTION |
    Gtk.AccessibleProperty.VALUE_TEXT;

type BooleanAccessibleProperty =
    Gtk.AccessibleProperty.HAS_POPUP |
    Gtk.AccessibleProperty.MODAL |
    Gtk.AccessibleProperty.MULTI_LINE |
    Gtk.AccessibleProperty.MULTI_SELECTABLE |
    Gtk.AccessibleProperty.READ_ONLY |
    Gtk.AccessibleProperty.REQUIRED;

type NumberAccessibleProperty =
    Gtk.AccessibleProperty.LEVEL |
    Gtk.AccessibleProperty.VALUE_MAX |
    Gtk.AccessibleProperty.VALUE_MIN |
    Gtk.AccessibleProperty.VALUE_NOW;

/** A text matcher that also takes normalization options for the text it reads. */
type TextContentMatcher = (
    received: unknown,
    expected?: TextExpectation,
    options?: TextContentOptions,
) => MatcherResult;

/** Signatures of the widget assertion matchers, keyed by the name each is registered under. */
type MatcherImplementations = {
    /** Asserts the text an editable widget or combo box shows; with no argument, that it is not empty. */
    toHaveDisplayValue: TextMatcher;
    /** Asserts the widget's own text, or its descendants' when it has none, contains or matches the expectation. */
    toHaveTextContent: TextContentMatcher;
    /** Asserts the widget's accessible name; with no argument, that it has one. */
    toHaveAccessibleName: TextMatcher;
    /**
     * Asserts the joined accessible names of the widget's `described-by` targets, falling back to its
     * `description` and then to its tooltip.
     */
    toHaveAccessibleDescription: TextMatcher;
    /** Asserts the joined accessible names of the widget's `error-message` targets, read only while it is invalid. */
    toHaveAccessibleErrorMessage: TextMatcher;
    /** Asserts the text currently selected in an editable widget. */
    toHaveSelection: TextMatcher;
    /**
     * Asserts an accessible state GTK holds for the widget, taking the value type that state carries.
     * With no expected value, asserts only that the state is set to something determinate.
     */
    toHaveAccessibleState: (
        received: unknown,
        state: Gtk.AccessibleState,
        expected?: boolean | number,
    ) => MatcherResult;
    /**
     * Asserts an accessible property GTK holds for the widget, taking the value type that property
     * carries. With no expected value, asserts only that the property is set. Numeric properties
     * compare the way `toHaveValue` and the `value` option of the `ByRole` queries do, within 0.001.
     */
    toHaveAccessibleProperty: (
        received: unknown,
        property: Gtk.AccessibleProperty,
        expected?: AccessibleAttributeValue,
    ) => MatcherResult;
    /** Asserts the widget's checked state is checked rather than unchecked or mixed. */
    toBeChecked: StateMatcher;
    /** Asserts the widget's checked state is mixed. */
    toBePartiallyChecked: StateMatcher;
    /** Asserts a `Gtk.ToggleButton` is active, and throws for any other widget. */
    toBePressed: StateMatcher;
    /** Asserts the widget's accessible pressed state is mixed, and throws when it exposes none. */
    toBePartiallyPressed: StateMatcher;
    /** Asserts the widget is insensitive, or sits inside an insensitive ancestor. */
    toBeDisabled: StateMatcher;
    /** Asserts the widget and all of its ancestors are sensitive. */
    toBeEnabled: StateMatcher;
    /** Asserts the widget and its ancestors are all visible, and that none of them is fully transparent. */
    toBeVisible: StateMatcher;
    /** Asserts the widget's root is a window that is still in the toplevel list. */
    toBeRooted: StateMatcher;
    /** Asserts the widget has neither a child nor label text. */
    toBeEmptyWidget: StateMatcher;
    /** Asserts the widget's accessible invalid state is set to anything other than false. */
    toBeInvalid: StateMatcher;
    /** Asserts the widget's accessible invalid state is unset or false. */
    toBeValid: StateMatcher;
    /** Asserts the widget's accessible required state. */
    toBeRequired: StateMatcher;
    /** Asserts the widget holds the platform focus state. */
    toHaveFocus: StateMatcher;
    /**
     * Asserts a widget's numeric value, or its display value when a string is given.
     *
     * Numbers come from the accessibility tree, which GTK keeps to a resolution of 0.001: it drops an
     * update whose value is nearer than that to the one already published, so a widget that moves by
     * less keeps its previous value. Numbers therefore match within 0.001, the same tolerance the
     * `value` option of the `ByRole` queries and `toHaveAccessibleProperty` apply. That option reads
     * the same tree, where the maximum of a paged widget such as a scrollbar is the last value it can
     * reach, its adjustment's upper bound less one page.
     */
    toHaveValue: (received: unknown, expected?: number | string) => MatcherResult;
    /** Asserts the widget's accessible role. */
    toHaveRole: (received: unknown, expected: Gtk.AccessibleRole) => MatcherResult;
    /** Asserts the widget is, or is an ancestor of, the given widget. */
    toContainElement: (received: unknown, descendant: Gtk.Widget | null) => MatcherResult;
    /** Asserts the widget comes before the given widget in the widget tree, neither containing the other. */
    toAppearBefore: (received: unknown, other: Gtk.Widget) => MatcherResult;
    /** Asserts the widget comes after the given widget in the widget tree, neither containing the other. */
    toAppearAfter: (received: unknown, other: Gtk.Widget) => MatcherResult;
    /** Asserts at least one widget under the received one matches the `ByRole` query. */
    toContainAnyByRole: ContainmentMatcher<RoleQueryArgs>;
    /** Asserts exactly one widget under the received one matches the `ByRole` query. */
    toContainOneByRole: ContainmentMatcher<RoleQueryArgs>;
    /** Asserts at least one widget under the received one matches the `ByText` query. */
    toContainAnyByText: ContainmentMatcher<TextQueryArgs>;
    /** Asserts exactly one widget under the received one matches the `ByText` query. */
    toContainOneByText: ContainmentMatcher<TextQueryArgs>;
    /** Asserts at least one widget under the received one matches the `ByLabelText` query. */
    toContainAnyByLabelText: ContainmentMatcher<TextQueryArgs>;
    /** Asserts exactly one widget under the received one matches the `ByLabelText` query. */
    toContainOneByLabelText: ContainmentMatcher<TextQueryArgs>;
    /** Asserts at least one widget under the received one matches the `ByPlaceholderText` query. */
    toContainAnyByPlaceholderText: ContainmentMatcher<TextQueryArgs>;
    /** Asserts exactly one widget under the received one matches the `ByPlaceholderText` query. */
    toContainOneByPlaceholderText: ContainmentMatcher<TextQueryArgs>;
    /** Asserts at least one widget under the received one matches the `ByDisplayValue` query. */
    toContainAnyByDisplayValue: ContainmentMatcher<TextQueryArgs>;
    /** Asserts exactly one widget under the received one matches the `ByDisplayValue` query. */
    toContainOneByDisplayValue: ContainmentMatcher<TextQueryArgs>;
    /**
     * Asserts the widget carries every given style class, each a name, a space-separated list, or a pattern.
     * Pass `{ exact: true }` last to require exactly that set, which rules out patterns.
     */
    toHaveClass: (received: unknown, ...args: unknown[]) => MatcherResult;
    /**
     * Asserts a GObject property, named as in GObject and looked up by its camel-cased accessor, equals the
     * expected value. With no expected value, asserts the property is set. GObject values compare by identity.
     */
    toHaveObjectProperty: (this: MatcherContext, received: unknown, ...args: unknown[]) => MatcherResult;
};

type ExpectExtend = { extend: (m: MatcherImplementations) => void };

type AttributeExpectation = {
    label: string;
    comparison: string;
    expected: AccessibleAttributeValue;
    actual: AccessibleAttributeValue | null;
    isPass: boolean;
    isReadingRounded: boolean;
};

const registration = { isRegistered: false };
const MIXED_TRISTATE: number = Gtk.AccessibleTristate.MIXED;
const ROUNDED_READING = ", which the accessibility tree rounds to six significant digits";
const displayValueMatcher: TextMatcher = textMatcher("toHaveDisplayValue", getWidgetDisplayValue, "exact");
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

const toHaveSelection: TextMatcher = textMatcher("toHaveSelection", getWidgetSelection, "exact");
const toBePressed: StateMatcher = booleanStateMatcher("toBePressed", "pressed", getWidgetPressedState);
const toBeRequired: StateMatcher = booleanStateMatcher("toBeRequired", "required", getWidgetRequiredState);

const toContainAnyByRole: ContainmentMatcher<RoleQueryArgs> = containmentMatcher(
    "toContainAnyByRole",
    false,
    queryAllByRole,
);

const toContainOneByRole: ContainmentMatcher<RoleQueryArgs> = containmentMatcher(
    "toContainOneByRole",
    true,
    queryAllByRole,
);

const toContainAnyByText: ContainmentMatcher<TextQueryArgs> = containmentMatcher(
    "toContainAnyByText",
    false,
    queryAllByText,
);

const toContainOneByText: ContainmentMatcher<TextQueryArgs> = containmentMatcher(
    "toContainOneByText",
    true,
    queryAllByText,
);

const toContainAnyByLabelText: ContainmentMatcher<TextQueryArgs> = containmentMatcher(
    "toContainAnyByLabelText",
    false,
    queryAllByLabelText,
);

const toContainOneByLabelText: ContainmentMatcher<TextQueryArgs> = containmentMatcher(
    "toContainOneByLabelText",
    true,
    queryAllByLabelText,
);

const toContainAnyByPlaceholderText: ContainmentMatcher<TextQueryArgs> = containmentMatcher(
    "toContainAnyByPlaceholderText",
    false,
    queryAllByPlaceholderText,
);

const toContainOneByPlaceholderText: ContainmentMatcher<TextQueryArgs> = containmentMatcher(
    "toContainOneByPlaceholderText",
    true,
    queryAllByPlaceholderText,
);

const toContainAnyByDisplayValue: ContainmentMatcher<TextQueryArgs> = containmentMatcher(
    "toContainAnyByDisplayValue",
    false,
    queryAllByDisplayValue,
);

const toContainOneByDisplayValue: ContainmentMatcher<TextQueryArgs> = containmentMatcher(
    "toContainOneByDisplayValue",
    true,
    queryAllByDisplayValue,
);

/** The widget assertion matchers keyed by name, suitable for passing to `expect.extend`. */
const matchers: MatcherImplementations = {
    toHaveDisplayValue,
    toHaveTextContent,
    toHaveAccessibleName,
    toHaveAccessibleDescription,
    toHaveAccessibleErrorMessage,
    toHaveSelection,
    toHaveAccessibleState,
    toHaveAccessibleProperty,
    toBeChecked,
    toBePartiallyChecked,
    toBePressed,
    toBePartiallyPressed,
    toBeDisabled,
    toBeEnabled,
    toBeVisible,
    toBeRooted,
    toBeEmptyWidget,
    toBeInvalid,
    toBeValid,
    toBeRequired,
    toHaveFocus,
    toHaveValue,
    toHaveRole,
    toContainElement,
    toAppearBefore,
    toAppearAfter,
    toContainAnyByRole,
    toContainOneByRole,
    toContainAnyByText,
    toContainOneByText,
    toContainAnyByLabelText,
    toContainOneByLabelText,
    toContainAnyByPlaceholderText,
    toContainOneByPlaceholderText,
    toContainAnyByDisplayValue,
    toContainOneByDisplayValue,
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
    object instanceof Gtk.Widget ? describeWidget(object) : `<${getTypeTag(object)}>`;

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

const isHoldingFocus = (widget: Gtk.Widget, root: Gtk.Window): boolean => {
    const focus = root.getFocus();

    return focus !== null && (focus === widget || focus.isAncestor(widget));
};

const isFocusHeldByInactiveWindow = (widget: Gtk.Widget): boolean => {
    const root = widget.getRoot();

    return root instanceof Gtk.Window && !isWindowActivated(root) && isHoldingFocus(widget, root);
};

const focusResult = (widget: Gtk.Widget, isPass: boolean): MatcherResult => {
    if (isPass || !isFocusHeldByInactiveWindow(widget)) {
        return stateResult(widget, "focused", isPass);
    }

    return {
        pass: false,
        message: () =>
            "expected widget to be focused: its window has given it the focus, " +
            `but that window is not active\n${describeWidget(widget)}`,
    };
};

const describeAttributeValue = (value: AccessibleAttributeValue | null): string =>
    value === null ? "unset" : JSON.stringify(value);

const attributeSetResult = (
    widget: Gtk.Widget,
    label: string,
    actual: AccessibleAttributeValue | null,
): MatcherResult => {
    const isSet = actual !== null;

    return {
        pass: isSet,
        message: () => `expected widget ${negationPrefix(isSet)}to have ${label} set\n${describeWidget(widget)}`,
    };
};

const describeReading = (expectation: AttributeExpectation): string =>
    `${describeAttributeValue(expectation.actual)}${expectation.isReadingRounded ? ROUNDED_READING : ""}`;

const attributeValueResult = (widget: Gtk.Widget, expectation: AttributeExpectation): MatcherResult => ({
    pass: expectation.isPass,
    message: () =>
        `expected widget ${negationPrefix(expectation.isPass)}to have ${expectation.label} ` +
        `${expectation.comparison} ${describeAttributeValue(expectation.expected)}, but received ` +
        `${describeReading(expectation)}\n${describeWidget(widget)}`,
});

const orderResult = (widget: Gtk.Widget, other: Gtk.Widget, position: string, isPass: boolean): MatcherResult => ({
    pass: isPass,
    message: () =>
        `expected widget ${negationPrefix(isPass)}to appear ${position} ${describeWidget(other)} ` +
        `in the widget tree\n${describeWidget(widget)}`,
});

const getTreeRoot = (widget: Gtk.Widget): Gtk.Widget => {
    let root = widget;
    let parent = root.getParent();

    while (parent) {
        root = parent;
        parent = root.getParent();
    }

    return root;
};

const isSeparateWidget = (first: Gtk.Widget, second: Gtk.Widget): boolean =>
    first !== second && !first.isAncestor(second) && !second.isAncestor(first);

const isPrecedingWidget = (root: Gtk.Widget, first: Gtk.Widget, second: Gtk.Widget): boolean => {
    for (const widget of descendants(root)) {
        if (widget === first) {
            return true;
        }

        if (widget === second) {
            return false;
        }
    }

    return false;
};

const isAppearingBefore = (first: Gtk.Widget, second: Gtk.Widget): boolean => {
    const root = getTreeRoot(first);

    return isSeparateWidget(first, second) && root === getTreeRoot(second) && isPrecedingWidget(root, first, second);
};

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

function readObjectProperty(object: GObject.Object, name: string): unknown {
    const value: unknown = Reflect.apply(GObject.getObjectProperty, undefined, [object, name]);

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

function normalizeTextContent(text: string, options?: TextContentOptions): string {
    if (options?.normalizeWhitespace === false) {
        return text.replaceAll("\u{A0}", " ");
    }

    return getDefaultNormalizer()(text);
}

function readTextContent(widget: Gtk.Widget, options?: TextContentOptions): string | null {
    const text = getWidgetTextContent(widget);

    return text === null ? null : normalizeTextContent(text, options);
}

function toHaveTextContent(
    received: unknown,
    expected?: TextExpectation,
    options?: TextContentOptions,
): MatcherResult {
    const read = (widget: Gtk.Widget): string | null => readTextContent(widget, options);

    return textMatcher("toHaveTextContent", read, "substring")(received, expected);
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

function containmentMatcher<Args extends unknown[]>(
    matcherName: string,
    isSingle: boolean,
    queryAll: QueryAll<Args>,
): ContainmentMatcher<Args> {
    const quantity = isSingle ? "exactly one widget" : "any widget";

    return (received: unknown, ...args: Args): MatcherResult => {
        const widget = asWidget(received, matcherName);
        const matches = queryAll(widget, ...args);
        const isPass = isSingle ? matches.length === 1 : matches.length > 0;

        return {
            pass: isPass,
            message: () =>
                `expected widget ${negationPrefix(isPass)}to contain ${quantity} matching ${matcherName}, ` +
                `but found ${String(matches.length)}\n${describeWidget(widget)}`,
        };
    };
}

function toHaveAccessibleState(
    received: unknown,
    state: Gtk.AccessibleState,
    expected?: boolean | number,
): MatcherResult {
    const widget = asWidget(received, "toHaveAccessibleState");
    const actual = readAccessibleState(widget, state);
    const label = `accessible state ${Gtk.AccessibleState[state]}`;

    if (expected === undefined) {
        return attributeSetResult(widget, label, actual);
    }

    const wanted = typeof expected === "boolean" ? Number(expected) : expected;

    return attributeValueResult(widget, {
        label,
        comparison: "equal to",
        expected: wanted,
        actual,
        isPass: actual === wanted,
        isReadingRounded: false,
    });
}

const propertyLabel = (property: Gtk.AccessibleProperty): string =>
    `accessible property ${Gtk.AccessibleProperty[property]}`;

const propertyExpectation = (
    widget: Gtk.Widget,
    property: Gtk.AccessibleProperty,
    expected: AccessibleAttributeValue,
    actual: AccessibleAttributeValue | null,
): AttributeExpectation => {
    const label = propertyLabel(property);

    if (typeof expected === "number" && isAccessibleNumberProperty(property)) {
        return {
            label,
            comparison: `within ${String(ACCESSIBLE_NUMBER_TOLERANCE)} of`,
            expected,
            actual,
            isPass: isAccessibleNumberMatch(widget, property, expected),
            isReadingRounded: actual !== null,
        };
    }

    return { label, comparison: "equal to", expected, actual, isPass: actual === expected, isReadingRounded: false };
};

function toHaveAccessibleProperty(
    received: unknown,
    property: Gtk.AccessibleProperty,
    expected?: AccessibleAttributeValue,
): MatcherResult {
    const widget = asWidget(received, "toHaveAccessibleProperty");
    const actual = readAccessibleProperty(widget, property);

    if (expected === undefined) {
        return attributeSetResult(widget, propertyLabel(property), actual);
    }

    return attributeValueResult(widget, propertyExpectation(widget, property, expected, actual));
}

function toBePartiallyPressed(received: unknown): MatcherResult {
    const widget = asWidget(received, "toBePartiallyPressed");
    const state = readAccessibleState(widget, Gtk.AccessibleState.PRESSED);

    if (state === null) {
        throw notApplicable("toBePartiallyPressed", "pressed state", widget);
    }

    return stateResult(widget, "partially pressed", state === MIXED_TRISTATE);
}

function toAppearBefore(received: unknown, other: Gtk.Widget): MatcherResult {
    const widget = asWidget(received, "toAppearBefore");
    const target = asWidget(other, "toAppearBefore");

    return orderResult(widget, target, "before", isAppearingBefore(widget, target));
}

function toAppearAfter(received: unknown, other: Gtk.Widget): MatcherResult {
    const widget = asWidget(received, "toAppearAfter");
    const target = asWidget(other, "toAppearAfter");

    return orderResult(widget, target, "after", isAppearingBefore(target, widget));
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

const describeValueExpectation = (expected: number | undefined): string =>
    expected === undefined ? "set" : `within ${String(ACCESSIBLE_NUMBER_TOLERANCE)} of ${String(expected)}`;

function toHaveValue(received: unknown, expected?: number | string): MatcherResult {
    const widget = asWidget(received, "toHaveValue");

    if (typeof expected === "string") {
        return displayValueMatcher(received, expected);
    }

    const actual = getWidgetValueNow(widget);

    if (actual === null) {
        throw notApplicable("toHaveValue", "numeric value", widget);
    }

    const isPass = expected === undefined || isWidgetValueMatch(widget, "now", expected);

    return {
        pass: isPass,
        message: () =>
            `expected widget ${negationPrefix(isPass)}to have value ${describeValueExpectation(expected)}, ` +
            `but received ${String(actual)}${ROUNDED_READING}\n${describeWidget(widget)}`,
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

function toBeEmptyWidget(received: unknown): MatcherResult {
    const widget = asWidget(received, "toBeEmptyWidget");

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

    return focusResult(widget, widget.getPlatformState(Gtk.AccessiblePlatformState.FOCUSED));
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
    interface WidgetMatchers {
        toHaveDisplayValue(expected?: TextExpectation): void;
        toHaveTextContent(expected?: TextExpectation, options?: TextContentOptions): void;
        toHaveAccessibleName(expected?: TextExpectation): void;
        toHaveAccessibleDescription(expected?: TextExpectation): void;
        toHaveAccessibleErrorMessage(expected?: TextExpectation): void;
        toHaveSelection(expected?: TextExpectation): void;
        /* eslint-disable-next-line unicorn/consistent-boolean-name -- expected is the jest-dom matcher argument name */
        toHaveAccessibleState(state: BooleanAccessibleState, expected?: boolean): void;
        toHaveAccessibleState(state: TristateAccessibleState, expected?: Gtk.AccessibleTristate): void;
        toHaveAccessibleState(state: Gtk.AccessibleState.INVALID, expected?: Gtk.AccessibleInvalidState): void;
        toHaveAccessibleProperty(property: StringAccessibleProperty, expected?: string): void;
        /* eslint-disable-next-line unicorn/consistent-boolean-name -- expected is the jest-dom matcher argument name */
        toHaveAccessibleProperty(property: BooleanAccessibleProperty, expected?: boolean): void;
        toHaveAccessibleProperty(property: NumberAccessibleProperty, expected?: number): void;
        toHaveAccessibleProperty(
            property: Gtk.AccessibleProperty.AUTOCOMPLETE,
            expected?: Gtk.AccessibleAutocomplete,
        ): void;
        toHaveAccessibleProperty(property: Gtk.AccessibleProperty.ORIENTATION, expected?: Gtk.Orientation): void;
        toHaveAccessibleProperty(property: Gtk.AccessibleProperty.SORT, expected?: Gtk.AccessibleSort): void;
        toBeChecked(): void;
        toBePartiallyChecked(): void;
        toBePressed(): void;
        toBePartiallyPressed(): void;
        toBeDisabled(): void;
        toBeEnabled(): void;
        toBeVisible(): void;
        toBeRooted(): void;
        toBeEmptyWidget(): void;
        toBeInvalid(): void;
        toBeValid(): void;
        toBeRequired(): void;
        toHaveFocus(): void;
        toHaveValue(expected?: number | string): void;
        toHaveRole(expected: Gtk.AccessibleRole): void;
        toContainElement(descendant: Gtk.Widget | null): void;
        toAppearBefore(other: Gtk.Widget): void;
        toAppearAfter(other: Gtk.Widget): void;
        toContainAnyByRole(...args: RoleQueryArgs): void;
        toContainOneByRole(...args: RoleQueryArgs): void;
        toContainAnyByText(...args: TextQueryArgs): void;
        toContainOneByText(...args: TextQueryArgs): void;
        toContainAnyByLabelText(...args: TextQueryArgs): void;
        toContainOneByLabelText(...args: TextQueryArgs): void;
        toContainAnyByPlaceholderText(...args: TextQueryArgs): void;
        toContainOneByPlaceholderText(...args: TextQueryArgs): void;
        toContainAnyByDisplayValue(...args: TextQueryArgs): void;
        toContainOneByDisplayValue(...args: TextQueryArgs): void;
        toHaveClass(...args: (ClassExpectation | { exact: boolean })[]): void;
        toHaveObjectProperty(name: string, expected?: unknown): void;
    }

    interface Assertion extends WidgetMatchers {}
    interface AsymmetricMatchersContaining extends WidgetMatchers {}
    /* eslint-enable @typescript-eslint/consistent-type-definitions */
}

export { matchers, registerMatchers, type ClassExpectation, type TextContentOptions, type TextExpectation };
