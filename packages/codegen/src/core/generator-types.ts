/**
 * Generator Types
 *
 * Shared TypeScript types used across FFI and JSX generators.
 * These types define the contracts between different parts of the code generation system.
 */

/**
 * Base options for FFI generators and builders.
 * Contains the common namespace and sharedLibrary fields.
 */
export type FfiGeneratorOptions = {
    /** Current namespace (e.g., "Gtk") */
    namespace: string;
    /** Shared library (e.g., "libgtk-4.so.1") */
    sharedLibrary: string;
    /** GLib shared library for GError types (derived from GIR) */
    glibLibrary: string;
    /** GObject shared library for g_object_new (derived from GIR) */
    gobjectLibrary: string;
};

/**
 * Analyzed property for JSX generation.
 */
export type PropertyAnalysis = {
    name: string;
    camelName: string;
    type: string;
    isRequired: boolean;
    isWritable: boolean;
    getter?: string;
    setter?: string;
    doc?: string;
    /** External namespaces referenced by this property's type (e.g., ["GLib", "cairo"]) */
    referencedNamespaces: string[];
};

/**
 * Analyzed signal parameter.
 */
export type SignalParam = {
    name: string;
    type: string;
};

/**
 * Analyzed signal for JSX generation.
 */
export type SignalAnalysis = {
    name: string;
    camelName: string;
    handlerName: string;
    parameters: SignalParam[];
    returnType: string;
    doc?: string;
    /** External namespaces referenced by this signal's types (e.g., ["GObject"]) */
    referencedNamespaces: string[];
};

/**
 * Minimal generator options for simple generators (enum, constant).
 * Used when only namespace context is needed.
 */
export type SimpleGeneratorOptions = {
    namespace: string;
};
