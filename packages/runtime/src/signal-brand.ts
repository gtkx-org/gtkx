const naturalSignalMember: unique symbol = Symbol("gtkx.naturalSignalMember");
const classSignalMember: unique symbol = Symbol("gtkx.classSignalMember");
const signalMapOverride: unique symbol = Symbol("gtkx.signalMapOverride");
const signalEmitMapOverride: unique symbol = Symbol("gtkx.signalEmitMapOverride");

type SignalMethodReceiver<T, K extends PropertyKey> = T extends {
    [naturalSignalMember]?: infer TMembers;
}
    ? K extends keyof NonNullable<TMembers>
        ? never
        : unknown
    : unknown;

type ResolvedSignalMap<T, TFallback> = T extends {
    [signalMapOverride]?: infer TResolver;
}
    ? TResolver extends () => infer TMap
        ? NonNullable<TMap>
        : TFallback
    : TFallback;

type ResolvedSignalEmitMap<T, TFallback> = T extends {
    [signalEmitMapOverride]?: infer TResolver;
}
    ? TResolver extends () => infer TMap
        ? NonNullable<TMap>
        : TFallback
    : TFallback;

export {
    classSignalMember,
    naturalSignalMember,
    signalEmitMapOverride,
    type ResolvedSignalEmitMap,
    type ResolvedSignalMap,
    signalMapOverride,
    type SignalMethodReceiver,
};
