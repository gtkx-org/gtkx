import * as Gtk from "@gtkx/gi/gtk";
import { getHandle, t } from "@gtkx/runtime";

type CheckInt = (handle: unknown, attribute: number, expected: number) => string | null;
type CheckString = (handle: unknown, attribute: number, expected: string | null) => string | null;
type CheckDouble = (handle: unknown, attribute: number, expected: number) => string | null;
type CheckRelation = (...args: unknown[]) => string | null;
/** A value GTK holds for an accessible property: a string, a number, a token, or a boolean. */
type AccessibleAttributeValue = boolean | number | string;
type PropertyReader = (accessible: Gtk.Accessible, property: Gtk.AccessibleProperty) => AccessibleAttributeValue | null;
type NativeCall = (...inputs: unknown[]) => unknown;
type CheckArg = typeof DOUBLE_ARG | typeof INT_ARG | typeof OBJECT_ARG | typeof STRING_ARG;

const LIB = "libgtk-4.so.1";
const MAX_RELATION_TARGETS = 8;
const relationBindings: Map<number, CheckRelation> = new Map();

const REVERSE_RELATIONS: Partial<Record<Gtk.AccessibleRelation, Gtk.AccessibleRelation>> = {
    [Gtk.AccessibleRelation.LABELLED_BY]: Gtk.AccessibleRelation.LABEL_FOR,
    [Gtk.AccessibleRelation.DESCRIBED_BY]: Gtk.AccessibleRelation.DESCRIPTION_FOR,
    [Gtk.AccessibleRelation.ERROR_MESSAGE]: Gtk.AccessibleRelation.ERROR_MESSAGE_FOR,
    [Gtk.AccessibleRelation.CONTROLS]: Gtk.AccessibleRelation.CONTROLLED_BY,
    [Gtk.AccessibleRelation.DETAILS]: Gtk.AccessibleRelation.DETAILS_FOR,
    [Gtk.AccessibleRelation.FLOW_TO]: Gtk.AccessibleRelation.FLOW_FROM,
};

const UNDEFINED_VALUE = -1;
const INT_SENTINEL = -2_147_483_648;
const NUMBER_SENTINEL = -Number.MAX_VALUE;
const ACCESSIBLE_NUMBER_TOLERANCE = 0.001;
const BOOLEAN_DOMAIN = [0, 1];
const OPTIONAL_BOOLEAN_DOMAIN = [0, 1, UNDEFINED_VALUE];
const TRISTATE_DOMAIN = [Gtk.AccessibleTristate.FALSE, Gtk.AccessibleTristate.TRUE, Gtk.AccessibleTristate.MIXED];

const INVALID_DOMAIN = [
    Gtk.AccessibleInvalidState.FALSE,
    Gtk.AccessibleInvalidState.TRUE,
    Gtk.AccessibleInvalidState.GRAMMAR,
    Gtk.AccessibleInvalidState.SPELLING,
];

const STATE_DOMAINS: Partial<Record<Gtk.AccessibleState, number[]>> = {
    [Gtk.AccessibleState.BUSY]: BOOLEAN_DOMAIN,
    [Gtk.AccessibleState.CHECKED]: TRISTATE_DOMAIN,
    [Gtk.AccessibleState.DISABLED]: BOOLEAN_DOMAIN,
    [Gtk.AccessibleState.EXPANDED]: OPTIONAL_BOOLEAN_DOMAIN,
    [Gtk.AccessibleState.HIDDEN]: BOOLEAN_DOMAIN,
    [Gtk.AccessibleState.INVALID]: INVALID_DOMAIN,
    [Gtk.AccessibleState.PRESSED]: TRISTATE_DOMAIN,
    [Gtk.AccessibleState.SELECTED]: OPTIONAL_BOOLEAN_DOMAIN,
    [Gtk.AccessibleState.VISITED]: OPTIONAL_BOOLEAN_DOMAIN,
};

const AUTOCOMPLETE_DOMAIN = [
    Gtk.AccessibleAutocomplete.NONE,
    Gtk.AccessibleAutocomplete.INLINE,
    Gtk.AccessibleAutocomplete.LIST,
    Gtk.AccessibleAutocomplete.BOTH,
];

const ORIENTATION_DOMAIN = [Gtk.Orientation.HORIZONTAL, Gtk.Orientation.VERTICAL];

const SORT_DOMAIN = [
    Gtk.AccessibleSort.NONE,
    Gtk.AccessibleSort.ASCENDING,
    Gtk.AccessibleSort.DESCENDING,
    Gtk.AccessibleSort.OTHER,
];

const TOKEN_DOMAINS: Partial<Record<Gtk.AccessibleProperty, number[]>> = {
    [Gtk.AccessibleProperty.AUTOCOMPLETE]: AUTOCOMPLETE_DOMAIN,
    [Gtk.AccessibleProperty.ORIENTATION]: ORIENTATION_DOMAIN,
    [Gtk.AccessibleProperty.SORT]: SORT_DOMAIN,
};

const STRING_PROPERTIES: Set<Gtk.AccessibleProperty> = new Set<Gtk.AccessibleProperty>([
    Gtk.AccessibleProperty.DESCRIPTION,
    Gtk.AccessibleProperty.HELP_TEXT,
    Gtk.AccessibleProperty.KEY_SHORTCUTS,
    Gtk.AccessibleProperty.LABEL,
    Gtk.AccessibleProperty.PLACEHOLDER,
    Gtk.AccessibleProperty.ROLE_DESCRIPTION,
    Gtk.AccessibleProperty.VALUE_TEXT,
]);

const BOOLEAN_PROPERTIES: Set<Gtk.AccessibleProperty> = new Set<Gtk.AccessibleProperty>([
    Gtk.AccessibleProperty.HAS_POPUP,
    Gtk.AccessibleProperty.MODAL,
    Gtk.AccessibleProperty.MULTI_LINE,
    Gtk.AccessibleProperty.MULTI_SELECTABLE,
    Gtk.AccessibleProperty.READ_ONLY,
    Gtk.AccessibleProperty.REQUIRED,
]);

const NUMBER_PROPERTIES: Set<Gtk.AccessibleProperty> = new Set<Gtk.AccessibleProperty>([
    Gtk.AccessibleProperty.VALUE_MAX,
    Gtk.AccessibleProperty.VALUE_MIN,
    Gtk.AccessibleProperty.VALUE_NOW,
]);

const OBJECT_ARG = { type: t.object("borrowed") };
const INT_ARG = { type: t.int32 };
const DOUBLE_ARG = { type: t.float64 };
const STRING_ARG = { type: t.string("borrowed") };
const CHECK_PROPERTY = "gtk_test_accessible_check_property";
const checkStateInt = buildAccessibleCheck("gtk_test_accessible_check_state", [INT_ARG]) as CheckInt;
const checkPropertyInt = buildAccessibleCheck(CHECK_PROPERTY, [INT_ARG]) as CheckInt;
const checkPropertyDouble = buildAccessibleCheck(CHECK_PROPERTY, [DOUBLE_ARG]) as CheckDouble;
const checkPropertyString = buildAccessibleCheck(CHECK_PROPERTY, [STRING_ARG]) as CheckString;

function buildAccessibleCheck(symbol: string, varargs: CheckArg[]): NativeCall {
    return t.fn(LIB, symbol, {
        args: [OBJECT_ARG, INT_ARG, ...varargs],
        returns: t.string("full"),
        fixedArgCount: 2,
    });
}

const buildRelationBinding = (targetCount: number): CheckRelation => {
    const targets = Array.from({ length: targetCount + 1 }, () => OBJECT_ARG);

    return buildAccessibleCheck("gtk_test_accessible_check_relation", targets) as CheckRelation;
};

const relationBindingFor = (targetCount: number): CheckRelation => {
    const cached = relationBindings.get(targetCount);

    if (cached !== undefined) {
        return cached;
    }

    const built = buildRelationBinding(targetCount);
    relationBindings.set(targetCount, built);

    return built;
};

const isRelationExactly = (
    accessible: Gtk.Accessible,
    relation: Gtk.AccessibleRelation,
    candidate: Gtk.Accessible,
    targetCount: number,
): boolean => {
    const call = relationBindingFor(targetCount);
    const repeated = Array.from({ length: targetCount }, () => getHandle(candidate));

    return call(getHandle(accessible), relation, ...repeated, null) === null;
};

const hasRelationSize = (
    accessible: Gtk.Accessible,
    relation: Gtk.AccessibleRelation,
    candidates: Gtk.Accessible[],
    size: number,
): boolean => candidates.some((candidate) => isRelationExactly(accessible, relation, candidate, size));

const findRelationSize = (
    accessible: Gtk.Accessible,
    relation: Gtk.AccessibleRelation,
    candidates: Gtk.Accessible[],
): number => {
    for (let size = 1; size <= MAX_RELATION_TARGETS; size += 1) {
        if (hasRelationSize(accessible, relation, candidates, size)) {
            return size;
        }
    }

    return 0;
};

const possibleTargets = (relation: Gtk.AccessibleRelation, candidates: Gtk.Accessible[]): Gtk.Accessible[] => {
    const reverse = REVERSE_RELATIONS[relation];

    if (reverse === undefined) {
        return candidates;
    }

    return candidates.filter((candidate) => Gtk.testAccessibleHasRelation(candidate, reverse));
};

const readAccessibleRelation = (
    accessible: Gtk.Accessible,
    relation: Gtk.AccessibleRelation,
    pool: Gtk.Accessible[],
): Gtk.Accessible[] => {
    if (!Gtk.testAccessibleHasRelation(accessible, relation)) {
        return [];
    }

    const candidates = possibleTargets(relation, pool);
    const size = findRelationSize(accessible, relation, candidates);

    if (size === 0) {
        return [];
    }

    return candidates.filter((candidate) => isRelationExactly(accessible, relation, candidate, size));
};

const memberOfDomain = (check: CheckInt, handle: unknown, attribute: number, domain: number[]): number | null => {
    for (const candidate of domain) {
        if (check(handle, attribute, candidate) === null) {
            return candidate;
        }
    }

    return null;
};

const readAccessibleState = (accessible: Gtk.Accessible, state: Gtk.AccessibleState): number | null => {
    const domain = STATE_DOMAINS[state];

    if (domain === undefined || !Gtk.testAccessibleHasState(accessible, state)) {
        return null;
    }

    const member = memberOfDomain(checkStateInt, getHandle(accessible), state, domain);

    return member === UNDEFINED_VALUE ? null : member;
};

const readAccessibleFlag = (accessible: Gtk.Accessible, state: Gtk.AccessibleState): boolean | null => {
    const value = readAccessibleState(accessible, state);

    return value === null ? null : value === 1;
};

const readAccessibleString = (accessible: Gtk.Accessible, property: Gtk.AccessibleProperty): string | null => {
    if (!Gtk.testAccessibleHasProperty(accessible, property)) {
        return null;
    }

    return checkPropertyString(getHandle(accessible), property, null);
};

const readAccessibleToken = (
    accessible: Gtk.Accessible,
    property: Gtk.AccessibleProperty,
    domain: number[],
): number | null => {
    if (!Gtk.testAccessibleHasProperty(accessible, property)) {
        return null;
    }

    return memberOfDomain(checkPropertyInt, getHandle(accessible), property, domain);
};

const readAccessibleBooleanProperty = (
    accessible: Gtk.Accessible,
    property: Gtk.AccessibleProperty,
): boolean | null => {
    const member = readAccessibleToken(accessible, property, BOOLEAN_DOMAIN);

    return member === null ? null : member === 1;
};

const readAgainstSentinel = (
    check: CheckDouble,
    sentinel: number,
    accessible: Gtk.Accessible,
    property: Gtk.AccessibleProperty,
): number | null => {
    if (!Gtk.testAccessibleHasProperty(accessible, property)) {
        return null;
    }

    const reported = check(getHandle(accessible), property, sentinel);

    return reported === null ? sentinel : Number(reported);
};

const readAccessibleInt = (accessible: Gtk.Accessible, property: Gtk.AccessibleProperty): number | null =>
    readAgainstSentinel(checkPropertyInt, INT_SENTINEL, accessible, property);

const readAccessibleNumber = (accessible: Gtk.Accessible, property: Gtk.AccessibleProperty): number | null =>
    readAgainstSentinel(checkPropertyDouble, NUMBER_SENTINEL, accessible, property);

const isAccessibleNumberProperty = (property: Gtk.AccessibleProperty): boolean => NUMBER_PROPERTIES.has(property);

const isAccessibleNumberMatch = (
    accessible: Gtk.Accessible,
    property: Gtk.AccessibleProperty,
    expected: number,
): boolean =>
    Gtk.testAccessibleHasProperty(accessible, property) &&
    checkPropertyDouble(getHandle(accessible), property, expected) === null;

const tokenReaderFor =
    (domain: number[]): PropertyReader =>
        (accessible, property) =>
            readAccessibleToken(accessible, property, domain);

const propertyReaderFor = (property: Gtk.AccessibleProperty): PropertyReader => {
    const domain = TOKEN_DOMAINS[property];

    if (domain !== undefined) {
        return tokenReaderFor(domain);
    }

    if (STRING_PROPERTIES.has(property)) {
        return readAccessibleString;
    }

    if (BOOLEAN_PROPERTIES.has(property)) {
        return readAccessibleBooleanProperty;
    }

    if (NUMBER_PROPERTIES.has(property)) {
        return readAccessibleNumber;
    }

    return readAccessibleInt;
};

const readAccessibleProperty = (
    accessible: Gtk.Accessible,
    property: Gtk.AccessibleProperty,
): AccessibleAttributeValue | null => propertyReaderFor(property)(accessible, property);

export {
    ACCESSIBLE_NUMBER_TOLERANCE,
    isAccessibleNumberMatch,
    isAccessibleNumberProperty,
    readAccessibleBooleanProperty,
    readAccessibleFlag,
    readAccessibleInt,
    readAccessibleNumber,
    readAccessibleProperty,
    readAccessibleRelation,
    readAccessibleState,
    readAccessibleString,
    type AccessibleAttributeValue,
};
