type WrappedShape = Promise<{
    visible: string;
}>;

type Variant = { kind: "selected"; selected: string } | { kind: "other"; other: number };

type Selected = Extract<Variant, { kind: "selected" }>;

type Other = Exclude<Variant, { kind: "selected" }>;

type GenericSelected<T> = Extract<T, { kind: "selected" }>;

type Conditional<T> = T extends { matches: true } ? { visible: T } : never;

export type { Conditional, GenericSelected, Other, Selected, WrappedShape };
