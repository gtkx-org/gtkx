/** Props left out of the generated element props, keyed by GLib type name. */
type OmittedProps = Record<string, string[]>;

const omittedProps: Map<string, Set<string>> = new Map();

const setOmittedProps = (props: OmittedProps): void => {
    omittedProps.clear();

    for (const [glibName, names] of Object.entries(props)) {
        omittedProps.set(glibName, new Set(names));
    }
};

const isOmittedProp = (glibName: string | undefined, jsName: string): boolean =>
    glibName !== undefined && omittedProps.get(glibName)?.has(jsName) === true;

/** Merges omitted-prop maps keyed by GLib type name, concatenating the names each map contributes. */
const mergeOmittedProps = (...maps: OmittedProps[]): OmittedProps => {
    const merged: OmittedProps = {};

    for (const map of maps) {
        for (const [glibName, names] of Object.entries(map)) {
            merged[glibName] = [...(merged[glibName] ?? []), ...names];
        }
    }

    return merged;
};

export { setOmittedProps, isOmittedProp, mergeOmittedProps, type OmittedProps };
