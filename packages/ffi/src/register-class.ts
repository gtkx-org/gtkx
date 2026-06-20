import {
    type RegisterClassOptions as NativeRegisterClassOptions,
    type RegisterClassVfunc as NativeRegisterClassVfunc,
    registerClass as nativeRegisterClass,
} from "@gtkx/native";
import type { AnyClass } from "@gtkx/utils";
import { type GType, TYPE_INVALID, typeInterfaces } from "./gtype.js";
import {
    getClassGtype,
    getInterfaceVfuncRegistry,
    getParentClass,
    getVfuncRegistry,
    setClassGtype,
    type VfuncDescriptor,
    walkClassChain,
} from "./registry.js";
import { wrapHandler } from "./handler-trampoline.js";

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

type DiscoveredVfunc<K extends "class" | "interface"> = VfuncDescriptor<K> & {
    readonly methodName: string;
    readonly fn: VfuncFn;
};

type DiscoveredClassVfunc = DiscoveredVfunc<"class">;

type DiscoveredInterfaceVfunc = DiscoveredVfunc<"interface">;

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
    const parentGtype = resolveParentGtype(klass);
    if (parentGtype === TYPE_INVALID) {
        throw new TypeError(`registerClass: ${klass.name} must extend a registered wrapper class`);
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

function resolveParentGtype(klass: AnyClass): GType {
    return (
        walkClassChain(getParentClass(klass), (cls) => {
            const gtype = getClassGtype(cls);
            return gtype !== TYPE_INVALID ? gtype : undefined;
        }) ?? TYPE_INVALID
    );
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
 * Discovers vfunc overrides on `klass` by walking its own instance methods,
 * resolving each method name to a vtable slot descriptor and wrapping the
 * implementation in its native trampoline. `resolveDescriptor` chooses the slot
 * — a parent class struct for class vfuncs, an interface registry for interface
 * vfuncs — and `skip` excludes method names a higher-precedence vtable already
 * claimed.
 */
function collectDiscoveredVfuncs<K extends "class" | "interface">(
    klass: AnyClass,
    resolveDescriptor: (methodName: string) => VfuncDescriptor<K> | undefined,
    skip?: ReadonlySet<string>,
): DiscoveredVfunc<K>[] {
    const proto = (klass as { prototype: Record<string, VfuncFn> }).prototype;
    const result: DiscoveredVfunc<K>[] = [];
    for (const methodName of ownInstanceMethodNames(klass)) {
        if (skip?.has(methodName)) continue;
        const descriptor = resolveDescriptor(methodName);
        if (!descriptor) continue;
        const fn = proto[methodName];
        if (!fn) continue;
        result.push({ ...descriptor, methodName, fn: wrapVfunc(fn, descriptor.argTypes, descriptor.returnType) });
    }
    return result;
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
    return collectDiscoveredVfuncs(klass, (methodName) => {
        const descriptor = findClassVfuncDescriptor(klass, methodName);
        if (descriptor && UNSUPPORTED_CONSTRUCT_VFUNCS.has(methodName)) {
            throw new Error(
                `registerClass: overriding the GObject construct-time vtable slot '${methodName}' is not supported; run construct-time initialization in the subclass constructor, after super(...), instead`,
            );
        }
        return descriptor ?? undefined;
    });
}

/**
 * Adapts a JS-side vfunc implementation to the native trampoline through the
 * shared {@link wrapHandler}, binding the receiver `self` as `this`. Out
 * parameters surface as the handler's return value following the public
 * method's tuple convention; see {@link wrapHandler} for the marshalling.
 */
function wrapVfunc(
    fn: VfuncFn,
    argTypes: NativeRegisterClassVfunc["argTypes"],
    returnType: NativeRegisterClassVfunc["returnType"],
): VfuncFn {
    return wrapHandler(fn, { argTypes, returnType }, "this");
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
    const vfuncRegistry = getInterfaceVfuncRegistry(interfaceGtype);
    if (!vfuncRegistry) return [];
    return collectDiscoveredVfuncs(
        klass,
        (methodName) => {
            const entry = vfuncRegistry[methodName];
            return entry?.kind === "interface" ? entry : undefined;
        },
        claimedMethodNames,
    );
}

function findClassVfuncDescriptor(klass: AnyClass, methodName: string): VfuncDescriptor<"class"> | null {
    return (
        walkClassChain(getParentClass(klass), (cls) => {
            const entry = getVfuncRegistry(cls)?.[methodName];
            return entry?.kind === "class" ? entry : undefined;
        }) ?? null
    );
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
    const options: NativeRegisterClassOptions = {};
    if (hasClassVfuncs) options.vfuncs = [...classVfuncs];
    if (hasInterfaces) {
        options.interfaces = interfaceBindings.map((binding) => ({
            gtype: binding.gtype,
            vfuncs: [...binding.vfuncs],
        }));
    }
    return options;
}
