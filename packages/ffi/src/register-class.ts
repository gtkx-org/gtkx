import {
    registerClass as nativeRegisterClass,
    type RegisterClassOptions as NativeRegisterClassOptions,
    type RegisterClassVfunc as NativeRegisterClassVfunc,
} from "@gtkx/native";
import type { AnyClass } from "@gtkx/utils";
import { type GType, TYPE_INVALID, typeInterfaces } from "./gtype.js";
import {
    getClassGtype,
    getParentClass,
    getVfuncRegistry,
    type Handle,
    setClassGtype,
    wrapHandle,
} from "./registry.js";

/**
 * Generated descriptor of a vtable vfunc slot. Codegen emits one per vfunc on
 * each class-struct registry (e.g. `GObjectClass.setProperty`) or
 * interface-struct registry (e.g. `GIconIface.hash`), discriminated by `kind`.
 * Users never construct these manually — they are resolved automatically when
 * `registerClass` discovers methods on a subclass whose camelCase name matches
 * a vfunc declared on an ancestor class struct or an inherited interface.
 *
 * @typeParam K - Whether the slot lives on a class vtable or an interface vtable.
 */
type VfuncDescriptor<K extends "class" | "interface" = "class" | "interface"> = {
    readonly kind: K;
    readonly className: string;
    readonly vfuncName: string;
    readonly byteOffset: number;
    readonly argTypes: NativeRegisterClassVfunc["argTypes"];
    readonly returnType: NativeRegisterClassVfunc["returnType"];
};

/**
 * Options accepted by {@link registerClass}.
 */
export type RegisterClassOptions = {
    /**
     * The `GType` name to register under. Must be globally unique. Defaults
     * to `klass.name`.
     */
    readonly gtypeName?: string;
};

type VfuncFn = NativeRegisterClassVfunc["fn"];

type DiscoveredClassVfunc = VfuncDescriptor<"class"> & {
    readonly methodName: string;
    readonly fn: VfuncFn;
};

type DiscoveredInterfaceVfunc = VfuncDescriptor<"interface"> & {
    readonly methodName: string;
    readonly fn: VfuncFn;
};

type InterfaceVfuncBinding = {
    readonly gtype: GType;
    readonly vfuncs: readonly DiscoveredInterfaceVfunc[];
};

/**
 * Registers a JavaScript subclass of a generated wrapper class as a real
 * `GType` derived from the parent class's `GType`.
 *
 * The parent class's `GType` is resolved automatically from the prototype
 * chain. Virtual function overrides are auto-discovered: every own method on
 * the subclass whose camelCase name matches a vfunc on an ancestor's class
 * struct, or a vfunc of an interface the parent already implements, is
 * registered as the override implementation. A class vfunc takes precedence
 * when a method name matches both.
 *
 * @example
 * ```tsx
 * class MyButton extends Gtk.Button {
 *     activate() {
 *         // Overrides the GtkButtonClass.activate vfunc automatically.
 *     }
 * }
 * registerClass(MyButton);
 * ```
 */
export function registerClass<T extends AnyClass>(klass: T, options: RegisterClassOptions = {}): T {
    if (!hasRegisteredAncestor(klass)) {
        throw new TypeError(`registerClass: ${klass.name} must extend a registered wrapper class`);
    }

    const parentGtype = resolveParentGtype(klass);
    if (parentGtype === TYPE_INVALID) {
        throw new Error(`registerClass: ${klass.name} parent GType is invalid (TYPE_INVALID)`);
    }

    const name = options.gtypeName ?? klass.name;
    if (!name) {
        throw new Error("registerClass: cannot derive a GType name (anonymous class with no gtypeName option)");
    }

    const classVfuncs = discoverClassVfuncs(klass);
    const claimedMethodNames = new Set(classVfuncs.map((vfunc) => vfunc.methodName));
    const interfaceBindings = discoverInheritedInterfaceVfuncs(klass, parentGtype, claimedMethodNames);

    const nativeOptions = toNativeOptions(classVfuncs, interfaceBindings);
    const newGtype: GType = nativeRegisterClass(name, parentGtype, nativeOptions);
    setClassGtype(klass, newGtype);

    return klass;
}

function hasRegisteredAncestor(klass: AnyClass): boolean {
    let current: AnyClass | null = getParentClass(klass);
    while (current) {
        if (getClassGtype(current) !== TYPE_INVALID) return true;
        current = getParentClass(current);
    }
    return false;
}

function resolveParentGtype(klass: AnyClass): GType {
    let current = getParentClass(klass);
    while (current) {
        const gtype = getClassGtype(current);
        if (gtype !== TYPE_INVALID) return gtype;
        current = getParentClass(current);
    }
    return TYPE_INVALID;
}

function ownInstanceMethodNames(klass: AnyClass): string[] {
    const proto = (klass as { prototype?: object }).prototype;
    if (!proto) return [];
    return Object.getOwnPropertyNames(proto).filter((name) => {
        if (name === "constructor") return false;
        return typeof (proto as Record<string, unknown>)[name] === "function";
    });
}

/**
 * GObject class-struct vtable slots that fire during `g_object_new`, before the
 * wrapper's handle is linked. gtkx does not route these to JavaScript: a
 * subclass runs construct-time logic in its constructor, after `super(...)`,
 * where the handle is already live. An override of one is rejected rather than
 * silently dispatched to a half-built wrapper.
 */
const UNSUPPORTED_CONSTRUCT_VFUNCS: ReadonlySet<string> = new Set(["constructed", "setProperty", "getProperty"]);

function discoverClassVfuncs(klass: AnyClass): DiscoveredClassVfunc[] {
    const proto = (klass as { prototype: Record<string, VfuncFn> }).prototype;
    const result: DiscoveredClassVfunc[] = [];
    for (const methodName of ownInstanceMethodNames(klass)) {
        const descriptor = findClassVfuncDescriptor(klass, methodName);
        if (!descriptor) continue;
        if (UNSUPPORTED_CONSTRUCT_VFUNCS.has(methodName)) {
            throw new Error(
                `registerClass: overriding the GObject construct-time vtable slot '${methodName}' is not supported; run construct-time initialization in the subclass constructor, after super(...), instead`,
            );
        }
        const fn = proto[methodName];
        if (!fn) continue;
        result.push({ ...descriptor, methodName, fn: wrapVfunc(fn, descriptor.argTypes) });
    }
    return result;
}

/**
 * Wraps a JS-side vfunc implementation so the native trampoline can hand it
 * raw `ExternalObject<Handle>` arguments and the user code receives
 * fully-typed JS wrappers. The first object-typed argument — the GObject
 * `self` for any instance vfunc — is bound as `this` and is NOT forwarded
 * positionally, so subclass authors receive only the remaining vfunc
 * arguments and can write `this.setLayoutManager(...)` exactly the way they
 * would in any other instance method.
 */
function wrapVfunc(fn: VfuncFn, argTypes: NativeRegisterClassVfunc["argTypes"]): VfuncFn {
    return ((...rawArgs: unknown[]) => {
        const wrapped: unknown[] = rawArgs.map((arg, i) => {
            if (arg == null) return arg;
            const argType = argTypes[i] as { type?: string } | undefined;
            if (argType?.type === "gobject") {
                return wrapHandle(arg as Handle);
            }
            return arg;
        });
        const self = wrapped[0] ?? null;
        return (fn as (this: unknown, ...args: unknown[]) => unknown).apply(self, wrapped.slice(1));
    }) as VfuncFn;
}

/**
 * Discovers vfunc overrides for interfaces the new class inherits from its
 * parent. Each interface the parent type conforms to is checked for own
 * methods on `klass` whose camelCase name matches one of its vfuncs. Method
 * names already claimed by a class vfunc are skipped, so a class vtable slot
 * always wins over an interface slot of the same name.
 */
function discoverInheritedInterfaceVfuncs(
    klass: AnyClass,
    parentGtype: GType,
    claimedMethodNames: ReadonlySet<string>,
): InterfaceVfuncBinding[] {
    const bindings: InterfaceVfuncBinding[] = [];
    for (const interfaceGtype of typeInterfaces(parentGtype)) {
        const vfuncs = discoverInterfaceVfuncs(klass, interfaceGtype, claimedMethodNames);
        if (vfuncs.length > 0) {
            bindings.push({ gtype: interfaceGtype, vfuncs });
        }
    }
    return bindings;
}

function discoverInterfaceVfuncs(
    klass: AnyClass,
    interfaceGtype: GType,
    claimedMethodNames: ReadonlySet<string>,
): DiscoveredInterfaceVfunc[] {
    const vfuncRegistry = interfaceVfuncRegistryByGtype.get(interfaceGtype);
    if (!vfuncRegistry) return [];
    const proto = (klass as { prototype: Record<string, VfuncFn> }).prototype;
    const result: DiscoveredInterfaceVfunc[] = [];
    for (const methodName of ownInstanceMethodNames(klass)) {
        if (claimedMethodNames.has(methodName)) continue;
        const descriptor = vfuncRegistry[methodName];
        if (!descriptor) continue;
        const fn = proto[methodName];
        if (!fn) continue;
        const ifaceDescriptor = descriptor as VfuncDescriptor<"interface">;
        result.push({
            ...ifaceDescriptor,
            methodName,
            fn: wrapVfunc(fn, ifaceDescriptor.argTypes),
        });
    }
    return result;
}

function findClassVfuncDescriptor(klass: AnyClass, methodName: string): VfuncDescriptor<"class"> | null {
    let current = getParentClass(klass);
    while (current) {
        const vfuncRegistry = getVfuncRegistry(current);
        if (vfuncRegistry) {
            const entry = vfuncRegistry[methodName];
            if (entry) {
                return entry as VfuncDescriptor<"class">;
            }
        }
        current = getParentClass(current);
    }
    return null;
}

const interfaceVfuncRegistryByGtype = new Map<GType, Readonly<Record<string, unknown>>>();

/**
 * Registers a runtime mapping from an interface `GType` to its generated
 * vtable vfunc descriptor map so that {@link registerClass} can auto-discover
 * interface vfunc overrides on a subclass. Codegen calls this once per
 * interface at module load.
 */
export function registerInterfaceVfuncRegistry(gtype: GType, vfuncRegistry: Readonly<Record<string, unknown>>): void {
    if (gtype === TYPE_INVALID) return;
    interfaceVfuncRegistryByGtype.set(gtype, vfuncRegistry);
}

function toNativeOptions(
    classVfuncs: readonly DiscoveredClassVfunc[],
    interfaceBindings: readonly InterfaceVfuncBinding[],
): NativeRegisterClassOptions | undefined {
    const hasInterfaces = interfaceBindings.length > 0;
    const hasClassVfuncs = classVfuncs.length > 0;
    if (!hasClassVfuncs && !hasInterfaces) {
        return undefined;
    }
    return {
        vfuncs: hasClassVfuncs ? classVfuncs : undefined,
        interfaces: hasInterfaces ? interfaceBindings : undefined,
    } as NativeRegisterClassOptions;
}
