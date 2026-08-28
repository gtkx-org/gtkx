type ElementPropertyEntry = [name: string, flags: number, defaultValue?: unknown];

const registeredElementSignals: Record<string, Record<string, string>> = {};
const registeredElementProperties: Record<string, Record<string, ElementPropertyEntry>> = {};
const state = { version: 0 };

const registerElementMetadata = (
    name: string,
    _parent: string | undefined,
    ownSignals: Record<string, string>,
    ownProperties: Record<string, ElementPropertyEntry>,
): string => {
    registeredElementSignals[name] = ownSignals;
    registeredElementProperties[name] = ownProperties;
    state.version += 1;

    return name;
};

const elementMetadataVersion = (): number => state.version;

/** @internal */
export { type ElementPropertyEntry, registerElementMetadata };
export { elementMetadataVersion, registeredElementProperties, registeredElementSignals };
