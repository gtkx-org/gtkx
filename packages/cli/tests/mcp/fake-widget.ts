type FakeWidgetOverrides = {
    type?: string;
    activateAction?: (name: string, args: unknown) => boolean;
    getFirstChild?: () => unknown;
    getNextSibling?: () => unknown;
    getAccessibleRole?: () => number | undefined;
    getName?: () => string | null;
    getSensitive?: () => boolean;
    getVisible?: () => boolean;
    getRealized?: () => boolean;
    getMapped?: () => boolean;
    getCssClasses?: () => string[];
    getLabel?: () => string | null;
    getText?: () => string | null;
    getTitle?: () => string | null;
};

const DEFAULTS = {
    getFirstChild: () => null,
    getNextSibling: () => null,
    getAccessibleRole: () => 1,
    getName: () => null,
    getSensitive: () => true,
    getVisible: () => true,
    getRealized: () => true,
    getMapped: () => true,
    getCssClasses: () => [],
};

const makeFakeWidget = (overrides: FakeWidgetOverrides = {}): never => {
    const { type = "GtkWidget", ...rest } = overrides;

    return {
        constructor: { name: type },
        ...DEFAULTS,
        ...rest,
    } as never;
};

export { makeFakeWidget, type FakeWidgetOverrides };
