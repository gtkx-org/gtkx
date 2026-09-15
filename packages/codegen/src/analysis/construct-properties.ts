import type { GirClass } from "../gir/class.js";
import type { Library } from "../gir/library.js";
import { ancestorChain } from "../gir/ancestry.js";

const REQUIRED_CONSTRUCT_PROPS: ReadonlyMap<string, readonly string[]> = new Map([
    ["Gtk.SignalAction", ["signal-name"]],
    ["Gtk.NamedAction", ["action-name"]],
    ["Gtk.AlternativeTrigger", ["first", "second"]],
]);

const requiredConstructPropNames = (library: Library, klass: GirClass, namespaceName: string): Set<string> => {
    const names: Set<string> = new Set();

    for (const ancestor of ancestorChain(library, klass, namespaceName)) {
        const key = `${ancestor.namespaceName}.${ancestor.klass.name}`;
        const required = REQUIRED_CONSTRUCT_PROPS.get(key) ?? [];

        for (const name of required) {
            names.add(name);
        }
    }

    return names;
};

export { requiredConstructPropNames };
