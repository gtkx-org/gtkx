import { noGlibPrefix } from "../src/rules/no-glib-prefix.js";
import { createRuleTester } from "./rule-tester.js";

const ruleTester = createRuleTester();

ruleTester.run("no-glib-prefix", noGlibPrefix, {
    valid: [
        { code: "type Interface = object;\n" },
        { code: "const GL_BOOLEAN = \"GLboolean\";\n" },
        { code: "const GIR_FILE_SUFFIX = \".gir\";\n" },
        { code: "const GENERATED_HEADER = \"x\";\n" },
        { code: "const GTKX_CONFIG_VIRTUAL_ID = \"virtual:gtkx-config\";\n" },
        { code: "import * as GObject from \"@gtkx/gi/gobject\";\n" },
        { code: "import type { GInterface } from \"./x.js\";\n" },
        { code: "const TYPE_INTERFACE = typeFromName(\"GInterface\");\n" },
        { code: "type GtkxOptions = object;\n" },
        { code: "class Gtk {}\n" },
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
    ],
});
