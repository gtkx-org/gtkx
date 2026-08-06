import { noLibraryPrefix } from "../src/rules/no-library-prefix.js";
import { createRuleTester } from "./rule-tester.js";

const ruleTester = createRuleTester();

ruleTester.run("no-library-prefix", noLibraryPrefix, {
    valid: [
        { code: "type Interface = object;\n" },
        { code: "const GL_BOOLEAN = \"GLboolean\";\n" },
        { code: "const GIR_FILE_SUFFIX = \".gir\";\n" },
        { code: "const GENERATED_HEADER = \"x\";\n" },
        { code: "const GTKX_CONFIG_VIRTUAL_ID = \"virtual:gtkx-config\";\n" },
        { code: "import * as GObject from \"@gtkx/gi/gobject\";\n" },
        { code: "import type { GInterface } from \"./x.js\";\n" },
        { code: "import { GtkLabel } from \"@gtkx/jsx/gtk\";\n" },
        { code: "const TYPE_INTERFACE = typeFromName(\"GInterface\");\n" },
        { code: "const ELEMENTS = { GtkWindow: 1 };\n" },
        { code: "type GtkxOptions = object;\n" },
        { code: "const gtkxIcons = () => 1;\n" },
        { code: "declare module \"@gtkx/jsx/gtk\" {\n    interface GtkWidgetProps {\n        a: 1;\n    }\n}\n" },
    ],
    invalid: [
        {
            code: "type GInterface = object;\n",
            errors: [{ messageId: "glibPrefix", data: { name: "GInterface", stripped: "Interface" } }],
        },
        {
            code: "class GValue {}\n",
            errors: [{ messageId: "glibPrefix", data: { name: "GValue", stripped: "Value" } }],
        },
        {
            code: "const GError = 1;\n",
            errors: [{ messageId: "glibPrefix", data: { name: "GError", stripped: "Error" } }],
        },
        {
            code: "function GObjectFor() {}\n",
            errors: [{ messageId: "glibPrefix", data: { name: "GObjectFor", stripped: "ObjectFor" } }],
        },
        {
            code: "interface GType {\n    a: 1;\n}\n",
            errors: [{ messageId: "glibPrefix", data: { name: "GType", stripped: "Type" } }],
        },
        {
            code: "function positionsFor(gtk: unknown) {\n    return gtk;\n}\n",
            errors: [{ messageId: "gtkPrefix", data: { name: "gtk" } }],
        },
        {
            code: "const gtkDocToMarkdown = () => 1;\n",
            errors: [{ messageId: "gtkPrefix", data: { name: "gtkDocToMarkdown" } }],
        },
        {
            code: "type GtkWidgetProps = object;\n",
            errors: [{ messageId: "gtkPrefix", data: { name: "GtkWidgetProps" } }],
        },
        {
            code: "class Gtk {}\n",
            errors: [{ messageId: "gtkPrefix", data: { name: "Gtk" } }],
        },
        {
            code: "const GTK_LIB = \"libgtk-4.so.1\";\n",
            errors: [{ messageId: "gtkPrefix", data: { name: "GTK_LIB" } }],
        },
        {
            code: "const { gtkMinor } = versions;\n",
            errors: [{ messageId: "gtkPrefix", data: { name: "gtkMinor" } }],
        },
        {
            code: "class Store {\n    gtkModel = 1;\n}\n",
            errors: [{ messageId: "gtkPrefix", data: { name: "gtkModel" } }],
        },
        {
            code: "enum Kind {\n    GtkFirst = 1,\n}\n",
            errors: [{ messageId: "gtkPrefix", data: { name: "GtkFirst" } }],
        },
    ],
});
