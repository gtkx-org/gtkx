import { join } from "node:path";
import type { GlibNamedClass } from "./intrinsic-elements.js";
import { namespaceDirectory } from "../../gir/namespace.js";
import { arrayGuard, hasFields, isBoolean, isString } from "../../guards.js";
import { readJsonFile } from "../../json.js";

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

const collectGeneratedElements = (intrinsicElements: GlibNamedClass[]): GeneratedElement[] =>
    intrinsicElements
        .map((entry) => ({
            namespace: entry.namespace.name,
            directory: namespaceDirectory(entry.namespace),
            glibName: entry.glibName,
            isMountable: !entry.klass.isAbstract,
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
 * Reads the inventory of elements the `@gtkx/jsx` store binds, written into the store by codegen. Answers
 * "what does this project's JSX layer cover" without loading the store, which resolves `virtual:` specifiers
 * that only exist inside a Vite or Vitest build.
 *
 * @param jsxStoreDir The jsx store directory, as given by `resolveStore(projectRoot).jsx.storeDir`.
 * @returns Every bound element, sorted by GLib type name, or an empty array when the store holds no inventory
 * codegen wrote, which covers an absent, unreadable, unparseable and structurally foreign store file alike.
 */
const readGeneratedElements = (jsxStoreDir: string): GeneratedElement[] => {
    const parsed = readJsonFile(join(jsxStoreDir, ELEMENTS_FILENAME));

    return isGeneratedInventory(parsed) ? parsed : [];
};

export {
    ELEMENTS_FILENAME,
    collectGeneratedElements,
    readGeneratedElements,
    renderGeneratedElements,
    type GeneratedElement,
};
