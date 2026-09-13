import type { AnyClass } from "@gtkx/utils";
import { offSignal, onceSignal, onSignal } from "./listeners.js";
import { getParamSpecFlags, getParamSpecOwnerType, getParamSpecValueType } from "./param-spec.js";
import { matchAllRegex, matchRegex } from "./regex.js";
import { getHandle, peekTypeClass } from "./registry.js";
import { disconnectSignal, type SignalHandler } from "./signal.js";
import { getBoxedValue, setBoxedValue } from "./value.js";

type ParamSpecReceiver = {
    getName(): string;
    getNick(): string;
    getBlurb(): string | null;
};

function regexMatch<TMatchInfo extends object>(
    this: object,
    subject: string,
    matchOptions: number,
): [boolean, TMatchInfo] {
    return matchRegex<TMatchInfo>(this, subject, 0, matchOptions);
}

function regexMatchAll<TMatchInfo extends object>(
    this: object,
    subject: string,
    matchOptions: number,
): [boolean, TMatchInfo] {
    return matchAllRegex<TMatchInfo>(this, subject, 0, matchOptions);
}

function regexMatchFull<TMatchInfo extends object>(
    this: object,
    subject: string | string[],
    startPosition: number,
    matchOptions: number,
): [boolean, TMatchInfo] {
    return matchRegex<TMatchInfo>(this, subject, startPosition, matchOptions);
}

function regexMatchAllFull<TMatchInfo extends object>(
    this: object,
    subject: string | string[],
    startPosition: number,
    matchOptions: number,
): [boolean, TMatchInfo] {
    return matchAllRegex<TMatchInfo>(this, subject, startPosition, matchOptions);
}

const createTypeClassPeek = <TClassStruct extends object>(classStruct: AnyClass<TClassStruct>, base?: AnyClass) =>
    (type: bigint | AnyClass): TClassStruct => peekTypeClass(type, base) as typeof classStruct.prototype;

function objectDisconnect(this: object, handlerId: number): void {
    disconnectSignal(this, handlerId);
}

function objectOn<TThis extends object>(
    this: TThis,
    signal: string,
    handler: SignalHandler,
    isAfter?: boolean,
): TThis {
    onSignal(this, signal, handler, isAfter);

    return this;
}

function objectOnce<TThis extends object>(
    this: TThis,
    signal: string,
    handler: SignalHandler,
    isAfter?: boolean,
): TThis {
    onceSignal(this, signal, handler, isAfter);

    return this;
}

function objectOff<TThis extends object>(this: TThis, signal: string, handler: SignalHandler): TThis {
    offSignal(this, signal, handler);

    return this;
}

const paramSpecGetters: PropertyDescriptorMap = {
    flags: {
        get(this: object): number {
            return getParamSpecFlags(this);
        },
    },
    valueType: {
        get(this: object): bigint {
            return getParamSpecValueType(this);
        },
    },
    ownerType: {
        get(this: object): bigint {
            return getParamSpecOwnerType(this);
        },
    },
    name: {
        get(this: ParamSpecReceiver): string {
            return this.getName();
        },
    },
    nick: {
        get(this: ParamSpecReceiver): string {
            return this.getNick();
        },
    },
    blurb: {
        get(this: ParamSpecReceiver): string | null {
            return this.getBlurb();
        },
    },
};

function valueGetBoxed(this: object): ReturnType<typeof getBoxedValue> {
    return getBoxedValue(getHandle(this));
}

function valueSetBoxed(this: object, boxed: Parameters<typeof setBoxedValue>[1]): void {
    setBoxedValue(getHandle(this), boxed);
}

export {
    createTypeClassPeek,
    objectDisconnect,
    objectOff,
    objectOn,
    objectOnce,
    paramSpecGetters,
    regexMatch,
    regexMatchAll,
    regexMatchAllFull,
    regexMatchFull,
    valueGetBoxed,
    valueSetBoxed,
};
