import { describe, expect, it } from "vitest";
import { generateJsxFiles } from "../../src/store/jsx/pipeline.js";
import { library } from "../helpers/library.js";

const BUTTON_DOC = "Calls a callback function when the button is clicked.";
const files = generateJsxFiles(library, { lazyElements: ["GtkStackPage"] });
// eslint-disable-next-line gtkx/no-library-prefix
const gtk = files.namespaces.find((entry) => entry.directory === "gtk")?.source ?? "";

const docBefore = (source: string, declaration: string): string => {
    const index = source.indexOf(declaration);

    if (index === -1) {
        throw new Error(`Missing declaration ${declaration}`);
    }

    const before = source.slice(0, index);
    const start = before.lastIndexOf("/**");
    const end = before.lastIndexOf("*/");

    if (start === -1 || end < start || before.slice(end + 2).trim().length > 0) {
        return "";
    }

    return before.slice(start, end + 2);
};

describe("jsx store documentation", () => {
    it("documents the props interface and the component export with the class doc", () => {
        expect(docBefore(gtk, "export interface GtkButtonProps<")).toContain(BUTTON_DOC);
        expect(docBefore(gtk, "export const GtkButton: (props: GtkButtonProps)")).toContain(BUTTON_DOC);

        expect(docBefore(gtk, "export const GtkWidget = \"GtkWidget\" as const;")).toContain(
            "The base class for all widgets.",
        );
    });

    it("carries the class deprecation onto the props interface", () => {
        expect(docBefore(gtk, "export interface GtkAssistantProps<")).toContain(
            "@deprecated Since 4.10. This widget will be removed in GTK 5",
        );
    });

    it("documents each property prop and its notify handler", () => {
        expect(docBefore(gtk, "label?: string | null | undefined;")).toContain("Text of the label inside the button");

        expect(docBefore(gtk, "onNotifyLabel?: ((value: string | null, self: Self) => void)")).toContain(
            "Called with the new value when `label` changes.",
        );
    });

    it("marks a deprecated property prop", () => {
        expect(docBefore(gtk, "useHeaderBar?: number | null | undefined;")).toContain(
            "@deprecated Since 4.10. This widget will be removed in GTK 5",
        );
    });

    it("documents signal handler props with their parameters and return value", () => {
        const doc = docBefore(gtk, "onActivateLink?: ((uri: string, self: Self)");
        expect(doc).toContain("Emitted every time a URL is activated.");
        expect(doc).toContain("@param uri the URI that is activated");
        expect(doc).toContain("@param self The instance the signal was emitted on.");
        expect(doc).toContain("@returns");
    });

    it("documents both declarations of a lazy element", () => {
        const auxiliary = "An auxiliary class used by `GtkStack`.";
        expect(docBefore(gtk, "export type GtkStackPageElementProps = ")).toContain(auxiliary);
        expect(docBefore(gtk, "export const GtkStackPage: (props: GtkStackPageElementProps)")).toContain(auxiliary);
    });
});
