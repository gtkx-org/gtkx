
export abstract class NativeObject {

    static readonly glibTypeName: string;

    static readonly objectType: "gobject" | "interface" | "boxed" | "gvariant";

    id: unknown;

    constructor(..._args: any[]) {}
}

export type NativeClass<T extends NativeObject = NativeObject> = typeof NativeObject & (new (...args: any[]) => T);

export let isInstantiating = false;

export const setInstantiating = (value: boolean): void => {
    isInstantiating = value;
};
