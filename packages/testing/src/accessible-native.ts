import * as Gtk from "@gtkx/gi/gtk";
import { getHandle, t } from "@gtkx/runtime";

type CheckInt = (handle: unknown, attribute: number, expected: number) => string | null;
type CheckString = (handle: unknown, attribute: number, expected: string | null) => string | null;
type CheckDouble = (handle: unknown, attribute: number, expected: number) => string | null;
type CheckRelation = (...args: unknown[]) => string | null;

const LIB = "libgtk-4.so.1";
const MAX_RELATION_TARGETS = 8;
const relationBindings: Map<number, CheckRelation> = new Map();
const UNDEFINED_VALUE = -1;
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

const checkStateInt = t.fn(LIB, "gtk_test_accessible_check_state", {
    args: [{ type: t.object("borrowed") }, { type: t.int32 }, { type: t.int32 }],
    returns: t.string("full"),
    fixedArgCount: 2,
}) as CheckInt;

const checkPropertyInt = t.fn(LIB, "gtk_test_accessible_check_property", {
    args: [{ type: t.object("borrowed") }, { type: t.int32 }, { type: t.int32 }],
    returns: t.string("full"),
    fixedArgCount: 2,
}) as CheckInt;

const checkPropertyDouble = t.fn(LIB, "gtk_test_accessible_check_property", {
    args: [{ type: t.object("borrowed") }, { type: t.int32 }, { type: t.float64 }],
    returns: t.string("full"),
    fixedArgCount: 2,
}) as CheckDouble;

const checkPropertyString = t.fn(LIB, "gtk_test_accessible_check_property", {
    args: [{ type: t.object("borrowed") }, { type: t.int32 }, { type: t.string("borrowed") }],
    returns: t.string("full"),
    fixedArgCount: 2,
}) as CheckString;

const buildRelationBinding = (targetCount: number): CheckRelation => {
    const args = [{ type: t.object("borrowed") }, { type: t.int32 }];

    for (let index = 0; index <= targetCount; index += 1) {
        args.push({ type: t.object("borrowed") });
    }

    return t.fn(LIB, "gtk_test_accessible_check_relation", {
        args,
        returns: t.string("full"),
        fixedArgCount: 2,
    }) as CheckRelation;
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

const readAccessibleRelation = (
    accessible: Gtk.Accessible,
    relation: Gtk.AccessibleRelation,
    candidates: Gtk.Accessible[],
): Gtk.Accessible[] => {
    if (!Gtk.testAccessibleHasRelation(accessible, relation)) {
        return [];
    }

    const size = findRelationSize(accessible, relation, candidates);

    if (size === 0) {
        return [];
    }

    return candidates.filter((candidate) => isRelationExactly(accessible, relation, candidate, size));
};

const memberOfDomain = (accessible: Gtk.Accessible, state: Gtk.AccessibleState, domain: number[]): number | null => {
    for (const candidate of domain) {
        if (checkStateInt(getHandle(accessible), state, candidate) === null) {
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

    const member = memberOfDomain(accessible, state, domain);

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

const readAccessibleInt = (accessible: Gtk.Accessible, property: Gtk.AccessibleProperty): number | null => {
    if (!Gtk.testAccessibleHasProperty(accessible, property)) {
        return null;
    }

    const reported = checkPropertyInt(getHandle(accessible), property, Number.MIN_SAFE_INTEGER);

    return reported === null ? Number.MIN_SAFE_INTEGER : Number(reported);
};

const readAccessibleNumber = (accessible: Gtk.Accessible, property: Gtk.AccessibleProperty): number | null => {
    if (!Gtk.testAccessibleHasProperty(accessible, property)) {
        return null;
    }

    const reported = checkPropertyDouble(getHandle(accessible), property, -Infinity);

    return reported === null ? -Infinity : Number(reported);
};

export {
    readAccessibleFlag,
    readAccessibleInt,
    readAccessibleNumber,
    readAccessibleRelation,
    readAccessibleState,
    readAccessibleString,
};
