export type PropCondition = "defined" | "nonNull" | "truthy";

export type SetterPropStep = {
    prop: string;
    call?: string;
    set?: string;
    when?: PropCondition;
    skipWhenGetterEquals?: string;
    requireGetterTruthyWithValue?: string;
    skipWhenGetterDivergedFromCommitted?: string;
};

export type SetterPropGroup = {
    kind: "setters";
    props: SetterPropStep[];
    always?: boolean;
};

export type SignalPropRule = {
    kind: "signal";
    prop: string;
    signal: string;
    noArgs?: boolean;
    returnValue?: unknown;
};

export type PropRule = SetterPropGroup | SignalPropRule;

export type AddMethodArg = "widget" | "id" | "title" | "iconName";

export type AddMethodRule = {
    method: string;
    args: AddMethodArg[];
    requires: AddMethodArg[];
};

export type PageMetaSetter = {
    setter: string;
    prop: string;
    fallback?: unknown;
    whenPresent?: boolean;
};
