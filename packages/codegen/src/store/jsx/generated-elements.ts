import { join } from "node:path";
import type { GlibNamedClass } from "./intrinsic-elements.js";
import { namespaceDirectory } from "../../gir/namespace.js";
import { arrayGuard, hasFields, isBoolean, isString } from "../../guards.js";
import { readJsonFile } from "../../json.js";
import { factoryElementPropTypeFor } from "./element-prop-imports.js";

/** One element the `@gtkx/jsx` store binds. */
type GeneratedElement = {
    /** GIR namespace name, such as `"Gtk"`. */
    namespace: string;
    /** Subexport the element is reachable through, such as `"gtk"` in `@gtkx/jsx/gtk`. */
    directory: string;
    /** GLib type name, which is also the JSX tag name, such as `"GtkButton"`. */
    glibName: string;
    /**
     * Whether the element can be rendered. An abstract GType is bound for its props and metadata but
     * exports no component, because `g_object_new` on one is a fatal GObject error.
     */
    isMountable: boolean;
};

const ELEMENTS_FILENAME = "elements.json";

const isMountableElement = (entry: GlibNamedClass): boolean =>
    !entry.klass.isAbstract || factoryElementPropTypeFor(entry.glibName) !== undefined;

const collectGeneratedElements = (intrinsicElements: GlibNamedClass[]): GeneratedElement[] =>
    intrinsicElements
        .map((entry) => ({
            namespace: entry.namespace.name,
            directory: namespaceDirectory(entry.namespace),
            glibName: entry.glibName,
            isMountable: isMountableElement(entry),
        }))
        .toSorted((a, b) => a.glibName.localeCompare(b.glibName));

const renderGeneratedElements = (elements: GeneratedElement[]): string =>
    `${JSON.stringify(elements, null, 2)}\n`;

const isGeneratedElement = (value: unknown): value is GeneratedElement =>
    hasFields<GeneratedElement>(value, {
        namespace: isString,
        directory: isString,
        glibName: isString,
        isMountable: isBoolean,
    });

const isGeneratedInventory = (value: unknown): value is GeneratedElement[] =>
    arrayGuard(isGeneratedElement)(value);

/**
 * Reads the generated JSX inventory without importing the store or resolving its build-only
 * `virtual:` imports.
 *
 * @param jsxStoreDir Generated JSX store directory.
 * @returns Elements sorted by GLib type name, or an empty array if the inventory is absent,
 * unreadable, unparseable, or has an unrecognized structure.
 */
const readGeneratedElements = (jsxStoreDir: string): GeneratedElement[] => {
    const parsed = readJsonFile(join(jsxStoreDir, ELEMENTS_FILENAME));

    return isGeneratedInventory(parsed) ? parsed : [];
};

export {
    ELEMENTS_FILENAME,
    collectGeneratedElements,
    isMountableElement,
    readGeneratedElements,
    renderGeneratedElements,
    type GeneratedElement,
};
