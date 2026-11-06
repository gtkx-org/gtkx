import type { AnyClass } from "@gtkx/runtime";
import { Variant, VariantType, variantTypeStringIsValid } from "@gtkx/gi/glib";
import { type ActionMap, SimpleAction } from "../gio.js";

/**
 * One action for `addActionEntries`, the plain-object form of `GActionEntry` that GJS's
 * `add_action_entries` takes, with camelCase fields.
 */
type ActionEntryObj = {
    /** The name of the action. */
    name: string;
    /**
     * Connected to the action's `activate` signal. It receives the action and the activation
     * parameter, with `this` set to the action, as in GJS and C.
     */
    activate?: (this: SimpleAction, action: SimpleAction, parameter: Variant | null) => void;
    /**
     * The type of the activation parameter: a GVariant type string such as `"s"`, or a
     * `GLib.VariantType`. Without it, the action takes no parameter.
     */
    parameterType?: string | VariantType;
    /**
     * The initial state: GVariant text such as `"'large'"` or `"true"`, a boolean, or a
     * `GLib.Variant`. Without it, the action is stateless.
     */
    state?: string | boolean | Variant;
    /**
     * Connected to the action's `change-state` signal. It receives the action and the requested
     * state, with `this` set to the action. Without it, a change request sets the state directly.
     */
    changeState?: (this: SimpleAction, action: SimpleAction, value: Variant | null) => void;
};

declare module "../gio.js" {
    interface ActionMap {
        /**
         * Creates a `Gio.SimpleAction` for each entry, connects its callbacks and adds it to
         * the map, like GJS's `add_action_entries` and C's `g_action_map_add_action_entries`.
         * An action with the same name as an existing one replaces it.
         *
         * @param entries the actions to add
         * @throws A `TypeError` if an entry has no string name, an `Error` if a `parameterType`
         * string is not a valid GVariant type, and a `GLib.Error` if a `state` string cannot be
         * parsed. Entries before the failing one stay added.
         */
        addActionEntries(entries: Iterable<ActionEntryObj>): void;
        /**
         * Removes the action named by each entry, as `g_action_map_remove_action_entries` does,
         * so the table passed to `addActionEntries` removes what it added.
         *
         * @param entries the actions to remove, by name
         */
        removeActionEntries(entries: Iterable<Pick<ActionEntryObj, "name">>): void;
    }
}

const entryName = (method: string, entry: Pick<ActionEntryObj, "name">): string => {
    const { name }: { name: unknown } = entry;

    if (typeof name !== "string") {
        throw new TypeError(`${method}: action entry name must be a string, got ${typeof name}`);
    }

    return name;
};

const entryParameterType = ({ parameterType }: ActionEntryObj): VariantType | null => {
    if (typeof parameterType === "string") {
        if (!variantTypeStringIsValid(parameterType)) {
            throw new Error(`addActionEntries: parameterType "${parameterType}" is not a valid VariantType`);
        }

        return new VariantType(parameterType);
    }

    return parameterType instanceof VariantType ? parameterType : null;
};

const entryState = ({ state }: ActionEntryObj): Variant | null => {
    if (typeof state === "boolean") {
        return new Variant("b", state);
    }

    if (typeof state === "string") {
        return Variant.parse(null, state, null, null);
    }

    return state instanceof Variant ? state : null;
};

function addActionEntries(this: ActionMap, entries: Iterable<ActionEntryObj>): void {
    for (const entry of entries) {
        const action = new SimpleAction({
            name: entryName("addActionEntries", entry),
            parameterType: entryParameterType(entry),
            state: entryState(entry),
        });
        const { activate, changeState } = entry;

        if (typeof activate === "function") {
            action.connect("activate", (parameter) => activate.call(action, action, parameter));
        }

        if (typeof changeState === "function") {
            action.connect("change-state", (value) => changeState.call(action, action, value));
        }

        this.addAction(action);
    }
}

function removeActionEntries(this: ActionMap, entries: Iterable<Pick<ActionEntryObj, "name">>): void {
    for (const entry of entries) {
        this.removeAction(entryName("removeActionEntries", entry));
    }
}

/**
 * Adds `addActionEntries` and `removeActionEntries` to the `Gio.ActionMap` members that every
 * implementing class receives.
 *
 * @internal Called by the generated `Gio.ActionMap` mixin.
 */
function extendActionMap<T extends AnyClass>(layer: T): T {
    Object.defineProperties(layer.prototype, {
        addActionEntries: { value: addActionEntries, writable: true, configurable: true },
        removeActionEntries: { value: removeActionEntries, writable: true, configurable: true },
    });

    return layer;
}

export { type ActionEntryObj, extendActionMap };
