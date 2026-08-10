type Entries = Record<string, unknown>;

const optional = (key: string, value: unknown): Entries =>
    value === undefined || value === null ? {} : { [key]: value };

const when = (isIncluded: boolean, entries: Entries): Entries => (isIncluded ? entries : {});

export { type Entries, optional, when };
