import { describe, expect, it } from "vitest";
import type { GirFunction } from "../../src/gir/function.js";
import { planCallArgs, renderMethodSignature } from "../../src/store/gi/method.js";
import { isClosureType } from "../../src/store/gi/param-marshal.js";
import { ModuleContext } from "../../src/writer/context.js";
import { library, locateCallable } from "../helpers/library.js";

type ClosureSite = { context: ModuleContext; callable: GirFunction; signature: string; args: string[] };

const INVOKED: string[] = [
    "g_binding_group_bind_with_closures",
    "g_bus_own_name_on_connection_with_closures",
    "g_bus_own_name_with_closures",
    "g_bus_watch_name_on_connection_with_closures",
    "g_bus_watch_name_with_closures",
    "g_dbus_connection_register_object_with_closures",
    "g_dbus_connection_register_object_with_closures2",
    "g_file_copy_async_with_closures",
    "g_file_move_async_with_closures",
    "g_object_bind_property_with_closures",
    "g_settings_bind_with_mapping_closures",
    "g_signal_connect_closure",
    "g_signal_connect_closure_by_id",
    "g_signal_group_connect_closure",
    "g_signal_override_class_closure",
    "g_source_set_closure",
    "gtk_closure_expression_new",
];

const MATCHED: string[] = [
    "g_signal_handler_find",
    "g_signal_handlers_block_matched",
    "g_signal_handlers_disconnect_matched",
    "g_signal_handlers_unblock_matched",
];

const MARSHALLED: string[] = [
    "g_cclosure_marshal_BOOLEAN__BOXED_BOXED",
    "g_cclosure_marshal_BOOLEAN__FLAGS",
    "g_cclosure_marshal_STRING__OBJECT_POINTER",
    "g_cclosure_marshal_VOID__BOOLEAN",
    "g_cclosure_marshal_VOID__BOXED",
    "g_cclosure_marshal_VOID__CHAR",
    "g_cclosure_marshal_VOID__DOUBLE",
    "g_cclosure_marshal_VOID__ENUM",
    "g_cclosure_marshal_VOID__FLAGS",
    "g_cclosure_marshal_VOID__FLOAT",
    "g_cclosure_marshal_VOID__INT",
    "g_cclosure_marshal_VOID__LONG",
    "g_cclosure_marshal_VOID__OBJECT",
    "g_cclosure_marshal_VOID__PARAM",
    "g_cclosure_marshal_VOID__POINTER",
    "g_cclosure_marshal_VOID__STRING",
    "g_cclosure_marshal_VOID__UCHAR",
    "g_cclosure_marshal_VOID__UINT",
    "g_cclosure_marshal_VOID__UINT_POINTER",
    "g_cclosure_marshal_VOID__ULONG",
    "g_cclosure_marshal_VOID__VARIANT",
    "g_cclosure_marshal_VOID__VOID",
    "g_cclosure_marshal_generic",
];

const WATCHED: string[] = ["g_object_watch_closure"];

const closureSite = (cIdentifier: string): ClosureSite => {
    const located = locateCallable(cIdentifier);

    if (located === undefined) {
        throw new Error(`${cIdentifier} was not found in any loaded namespace`);
    }

    const context = new ModuleContext(located.namespace, library);

    return {
        context,
        callable: located.callable,
        signature: renderMethodSignature(context, located.callable),
        args: planCallArgs(context, located.callable).map((arg) => arg.inputExpr ?? ""),
    };
};

const hasClosureParameter = (site: ClosureSite): boolean =>
    site.callable.parameters.some(
        (parameter) => parameter.type !== undefined && isClosureType(site.context, parameter.type),
    );

const hasMarshalledClosureArgument = (site: ClosureSite): boolean =>
    site.args.some((arg) => arg.startsWith("toClosure(") || arg.startsWith("tryToClosure("));

const expectClosureAcceptsCallback = (cIdentifier: string, isAccepted: boolean): void => {
    const site = closureSite(cIdentifier);
    expect(hasClosureParameter(site)).toBe(true);
    expect(site.signature.includes("| ClosureCallback")).toBe(isAccepted);
    expect(hasMarshalledClosureArgument(site)).toBe(isAccepted);
};

describe("closure parameters the callee invokes", () => {
    it.each(INVOKED)("accepts a function for %s and marshals it into a closure", (cIdentifier) => {
        expectClosureAcceptsCallback(cIdentifier, true);
    });
});

describe("closure parameters the callee does not invoke", () => {
    it.each([...MATCHED, ...MARSHALLED, ...WATCHED])("passes %s a plain closure handle", (cIdentifier) => {
        expectClosureAcceptsCallback(cIdentifier, false);
    });
});

describe("closure parameters a callback receives from C", () => {
    it("never widens a signature that has no C identifier to bind", () => {
        const located = locateCallable("g_signal_connect_closure");

        if (located === undefined) {
            throw new Error("g_signal_connect_closure was not found in any loaded namespace");
        }

        const context = new ModuleContext(located.namespace, library);
        const asCallback: GirFunction = { ...located.callable, cIdentifier: undefined };
        expect(renderMethodSignature(context, located.callable)).toContain("| ClosureCallback");
        expect(renderMethodSignature(context, asCallback)).not.toContain("ClosureCallback");
    });
});
