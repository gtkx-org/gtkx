export interface PropDiffOverride {
    diff?: ((prev: unknown, next: unknown) => boolean) | undefined;
}
