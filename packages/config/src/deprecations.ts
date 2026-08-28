import { warn } from "@gtkx/utils";
import type { Config } from "./config.ts";

type DeprecationId = (typeof DEPRECATION_IDS)[number];

type FutureDeprecation = {
    id: DeprecationId;
    flag: keyof NonNullable<Config["future"]>;
    change: string;
    unchecked?: string;
};

const SHOWN_ENV = "GTKX_DEPRECATIONS_SHOWN";
const GUIDE_URL = "https://gtkx.dev/guide/upgrading-to-2";
const ENTRY_COLUMN = 30;
const BUILD_REPORTS = " The build, not tsc, reports the specifiers still to change.";
const NOTHING_REPORTS = " Nothing reports this one; check the app yourself.";
const SILENT_SITES = " `Array.isArray` and `JSON.stringify` change silently; grep for them.";

const DEPRECATION_IDS = [
    "gtkx-v2-byte-arrays",
    "gtkx-v2-value-returns",
    "gtkx-v2-finish-results",
    "gtkx-v2-inout-returns",
    "gtkx-v2-resource-imports",
    "gtkx-v2-default-libraries",
] as const;

const FUTURE_DEPRECATIONS: FutureDeprecation[] = [
    {
        id: "gtkx-v2-byte-arrays",
        flag: "v2ByteArrays",
        change: "Byte sequences come back as number[]. In 2.0 they come back as Uint8Array.",
        unchecked: SILENT_SITES,
    },
    {
        id: "gtkx-v2-value-returns",
        flag: "v2ValueReturns",
        change: "Bindings that return a GValue hand back the box. In 2.0 they hand back its contents, as unknown.",
    },
    {
        id: "gtkx-v2-finish-results",
        flag: "v2FinishResults",
        change: "Async pairs with out parameters resolve with a leading success boolean. In 2.0 it is dropped.",
    },
    {
        id: "gtkx-v2-inout-returns",
        flag: "v2InoutReturns",
        change: "Inout records repeat in the return value. In 2.0 the repeated entry is dropped.",
    },
    {
        id: "gtkx-v2-resource-imports",
        flag: "v2ResourceImports",
        change: "Assets resolve through the #data/ import map. In 2.0 they resolve through ?resource imports.",
        unchecked: BUILD_REPORTS,
    },
    {
        id: "gtkx-v2-default-libraries",
        flag: "v2DefaultLibraries",
        change: "Only Gtk-4.0 is bound by default. In 2.0 Adw-1 is bound alongside it.",
        unchecked: NOTHING_REPORTS,
    },
];

const shownRoots: Map<string, string> = new Map();

const isSilenced = (config: Config, id: DeprecationId): boolean => (config.deprecations?.silence ?? []).includes(id);

const unsetDeprecations = (config: Config): FutureDeprecation[] =>
    FUTURE_DEPRECATIONS.filter((deprecation) => config.future?.[deprecation.flag] !== true);

const formatSummary = (unset: number, silenced: number): string => {
    const note = silenced === 0 ? "" : ` ${String(silenced)} of them silenced here.`;

    return (
        `${String(unset)} of ${String(FUTURE_DEPRECATIONS.length)} future flags are unset. ` +
        `Their behavior becomes the default in GTKX 2.0.${note}`
    );
};

const formatDeprecation = (deprecation: FutureDeprecation): string =>
    `  [${deprecation.id}]`.padEnd(ENTRY_COLUMN) +
    `future: { ${deprecation.flag}: true }\n    ${deprecation.change}` +
    (deprecation.unchecked ?? "");

const formatAdvice = (pending: FutureDeprecation[]): string => {
    if (pending.every((deprecation) => deprecation.unchecked === undefined)) {
        return "  Set one flag at a time and run tsc: every affected call site is a type error.";
    }

    return "  Set one flag at a time and run tsc: it reports every affected call site except where noted above.";
};

const formatBlock = (unset: FutureDeprecation[], pending: FutureDeprecation[], first: FutureDeprecation): string =>
    [
        formatSummary(unset.length, unset.length - pending.length),
        "",
        ...pending.flatMap((deprecation) => [formatDeprecation(deprecation), ""]),
        formatAdvice(pending),
        `  Guide    ${GUIDE_URL}`,
        `  Silence  deprecations: { silence: [${JSON.stringify(first.id)}] }`,
    ].join("\n");

const hasShown = (root: string, signature: string): boolean =>
    shownRoots.get(root) === signature || process.env[SHOWN_ENV] === signature;

const warnDeprecations = (config: Config, root: string): void => {
    const unset = unsetDeprecations(config);
    const pending = unset.filter((deprecation) => !isSilenced(config, deprecation.id));
    const [first] = pending;
    const signature = pending.map((deprecation) => deprecation.id).join(",");

    if (first === undefined || hasShown(root, signature)) {
        return;
    }

    shownRoots.set(root, signature);
    process.env[SHOWN_ENV] = signature;
    warn(formatBlock(unset, pending, first));
};

export { DEPRECATION_IDS, warnDeprecations };
