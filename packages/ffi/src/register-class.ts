import {
    registerClass as nativeRegisterClass,
    type RegisterClassVfuncDefinition,
    type RegisterClassVfuncOptions,
} from "@gtkx/native";
import type { AnyClass } from "@gtkx/utils";
import { G_TYPE_INVALID, type GType, typeInterfaces } from "./gtype.js";
import { getParentClass, getVfuncRegistry, type NativeHandle } from "./handles.js";
import { getClassGType, getNativeObject, setClassGType } from "./registry.js";

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
    readonly argTypes: RegisterClassVfuncDefinition["argTypes"];
    readonly returnType: RegisterClassVfuncDefinition["returnType"];
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

type VfuncFn = RegisterClassVfuncDefinition["fn"];

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
 * Registers a JavaScript subclass of a generated native class as a real
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
        throw new TypeError(`registerClass: ${klass.name} must extend a registered native class`);
    }

    const parentGType = resolveParentGType(klass);
    if (parentGType === G_TYPE_INVALID) {
        throw new Error(`registerClass: ${klass.name} parent GType is invalid (G_TYPE_INVALID)`);
    }

    const name = options.gtypeName ?? klass.name;
    if (!name) {
        throw new Error("registerClass: cannot derive a GType name (anonymous class with no gtypeName option)");
    }

    const classVfuncs = discoverClassVfuncs(klass);
    const claimedMethodNames = new Set(classVfuncs.map((vfunc) => vfunc.methodName));
    const interfaceBindings = discoverInheritedInterfaceVfuncs(klass, parentGType, claimedMethodNames);

    const nativeOptions = toNativeOptions(classVfuncs, interfaceBindings);
    const newGType: GType = nativeRegisterClass(name, parentGType, nativeOptions);
    setClassGType(klass, newGType);

    return klass;
}

function hasRegisteredAncestor(klass: AnyClass): boolean {
    let current: AnyClass | null = getParentClass(klass);
    while (current) {
        if (getClassGType(current) !== G_TYPE_INVALID) return true;
        current = getParentClass(current);
    }
    return false;
}

function resolveParentGType(klass: AnyClass): GType {
    let current = getParentClass(klass);
    while (current) {
        const gtype = getClassGType(current);
        if (gtype !== G_TYPE_INVALID) return gtype;
        current = getParentClass(current);
    }
    return G_TYPE_INVALID;
}

const SKIP_PROTOTYPE_NAMES = new Set(["constructor"]);

function ownInstanceMethodNames(klass: AnyClass): string[] {
    const proto = (klass as { prototype?: object }).prototype;
    if (!proto) return [];
    return Object.getOwnPropertyNames(proto).filter((name) => {
        if (SKIP_PROTOTYPE_NAMES.has(name)) return false;
        return typeof (proto as Record<string, unknown>)[name] === "function";
    });
}

function discoverClassVfuncs(klass: AnyClass): DiscoveredClassVfunc[] {
    const proto = (klass as { prototype: Record<string, VfuncFn> }).prototype;
    const result: DiscoveredClassVfunc[] = [];
    for (const methodName of ownInstanceMethodNames(klass)) {
        const descriptor = findClassVfuncDescriptor(klass, methodName);
        if (!descriptor) continue;
        const fn = proto[methodName];
        if (!fn) continue;
        result.push({ ...descriptor, methodName, fn: wrapVfunc(fn, descriptor.argTypes) });
    }
    return result;
}

/**
 * Wraps a JS-side vfunc implementation so the native trampoline can hand it
 * raw `ExternalObject<NativeHandle>` arguments and the user code receives
 * fully-typed JS wrappers. The first object-typed argument — the GObject
 * `self` for any instance vfunc — is bound as `this` and is NOT forwarded
 * positionally, so subclass authors receive only the remaining vfunc
 * arguments and can write `this.setLayoutManager(...)` exactly the way they
 * would in any other instance method.
 */
function wrapVfunc(fn: VfuncFn, argTypes: RegisterClassVfuncDefinition["argTypes"]): VfuncFn {
    return ((...rawArgs: unknown[]) => {
        const wrapped: unknown[] = rawArgs.map((arg, i) => {
            if (arg == null) return arg;
            const argType = argTypes[i] as { type?: string } | undefined;
            if (argType?.type === "gobject") {
                return getNativeObject(arg as NativeHandle);
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
    parentGType: GType,
    claimedMethodNames: ReadonlySet<string>,
): InterfaceVfuncBinding[] {
    const bindings: InterfaceVfuncBinding[] = [];
    for (const interfaceGType of typeInterfaces(parentGType)) {
        const vfuncs = discoverInterfaceVfuncs(klass, interfaceGType, claimedMethodNames);
        if (vfuncs.length > 0) {
            bindings.push({ gtype: interfaceGType, vfuncs });
        }
    }
    return bindings;
}

function discoverInterfaceVfuncs(
    klass: AnyClass,
    interfaceGType: GType,
    claimedMethodNames: ReadonlySet<string>,
): DiscoveredInterfaceVfunc[] {
    const vfuncRegistry = interfaceVfuncRegistryByGType.get(interfaceGType);
    if (!vfuncRegistry) return [];
    const proto = (klass as { prototype: Record<string, VfuncFn> }).prototype;
    const result: DiscoveredInterfaceVfunc[] = [];
    for (const methodName of ownInstanceMethodNames(klass)) {
        if (claimedMethodNames.has(methodName)) continue;
        const descriptor = vfuncRegistry[methodName];
        if (!descriptor || (descriptor as { kind?: string }).kind !== "interface") continue;
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
            if (entry && (entry as { kind?: string }).kind === "class") {
                return entry as VfuncDescriptor<"class">;
            }
        }
        current = getParentClass(current);
    }
    return null;
}

const interfaceVfuncRegistryByGType = new Map<GType, Readonly<Record<string, unknown>>>();

/**
 * Registers a runtime mapping from an interface `GType` to its generated
 * vtable vfunc descriptor map so that {@link registerClass} can auto-discover
 * interface vfunc overrides on a subclass. Codegen calls this once per
 * interface at module load.
 */
export function registerInterfaceVfuncRegistry(gtype: GType, vfuncRegistry: Readonly<Record<string, unknown>>): void {
    if (gtype === G_TYPE_INVALID) return;
    interfaceVfuncRegistryByGType.set(gtype, vfuncRegistry);
}

function toNativeOptions(
    classVfuncs: readonly DiscoveredClassVfunc[],
    interfaceBindings: readonly InterfaceVfuncBinding[],
): RegisterClassVfuncOptions | undefined {
    const hasInterfaces = interfaceBindings.length > 0;
    const hasClassVfuncs = classVfuncs.length > 0;
    if (!hasClassVfuncs && !hasInterfaces) {
        return undefined;
    }
    return {
        vfuncs: hasClassVfuncs ? classVfuncs : undefined,
        interfaceVfuncs: hasInterfaces ? interfaceBindings : undefined,
    };
}
