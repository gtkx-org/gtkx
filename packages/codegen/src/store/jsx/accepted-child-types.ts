const acceptedChildTypes: Map<string, string[]> = new Map();

const setAcceptedChildTypes = (types: Record<string, string[]>): void => {
    acceptedChildTypes.clear();

    for (const [parent, children] of Object.entries(types)) {
        acceptedChildTypes.set(parent, [...children]);
    }
};

const acceptedChildTypesFor = (glibName: string): string[] => acceptedChildTypes.get(glibName) ?? [];

export { acceptedChildTypesFor, setAcceptedChildTypes };
