const naturalSignalMember: unique symbol = Symbol("gtkx.naturalSignalMember");
const classSignalMember: unique symbol = Symbol("gtkx.classSignalMember");
const signalMapOverride: unique symbol = Symbol("gtkx.signalMapOverride");
const signalEmitMapOverride: unique symbol = Symbol("gtkx.signalEmitMapOverride");

type SignalArguments<T> = T extends { args: infer TArgs extends unknown[] } ? TArgs : never;
type SignalResult<T> = T extends { result: infer TResult } ? TResult : never;

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
    type SignalArguments,
    type SignalResult,
    signalMapOverride,
};
