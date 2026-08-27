import { CssProvider } from "@gtkx/gi/gtk";
import { randomBytes } from "node:crypto";

type Gate = { provider: CssProvider | null; ruleset: string | null };

const PROBE_BYTES = 16;
const PROBE_RULE = `.gtkx-probe-${randomBytes(PROBE_BYTES).toString("hex")}{color:rgb(0, 0, 0);}`;
const SWALLOWS_WHAT_FOLLOWS = "would disable every rule after it";
const gate: Gate = { provider: null, ruleset: null };

const ignoreParsingError = (): undefined => undefined;

const createQuietProvider = (): CssProvider => {
    const provider = new CssProvider();
    provider.on("parsing-error", ignoreParsingError);

    return provider;
};

const quiet = (): CssProvider => {
    gate.provider ??= createQuietProvider();

    return gate.provider;
};

const parsed = (document: string): string => {
    const provider = quiet();
    provider.loadFromString(document);

    return provider.toString();
};

const probe = (): string => {
    gate.ruleset ??= parsed(PROBE_RULE);

    return gate.ruleset;
};

const hasProbe = (serialized: string): boolean => {
    const ruleset = probe();

    return ruleset.length > 0 && `\n${serialized}`.includes(`\n${ruleset}`);
};

const containmentFailure = (rule: string): string | null =>
    hasProbe(parsed(`${rule}\n${PROBE_RULE}`)) ? null : SWALLOWS_WHAT_FOLLOWS;

export { containmentFailure };
