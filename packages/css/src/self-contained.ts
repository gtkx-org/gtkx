import { CssProvider } from "@gtkx/gi/gtk";

const PROBE_RULE = ".gtkx-probe{color:rgb(0, 0, 0);}";

const ignoreParsingError = (): undefined => undefined;

const parseQuietly = (provider: CssProvider, document: string): string => {
    provider.loadFromString(document);

    return provider.toString();
};

const isSelfContained = (rule: string): boolean => {
    const provider = new CssProvider();
    provider.on("parsing-error", ignoreParsingError);
    const followed = parseQuietly(provider, `${rule} ${PROBE_RULE}`);
    const alone = parseQuietly(provider, PROBE_RULE);

    return `\n${followed}`.includes(`\n${alone}`);
};

export { isSelfContained };
