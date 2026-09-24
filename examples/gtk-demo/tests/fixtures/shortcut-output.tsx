import { registerHooks } from "node:module";

type Scenario = "ctrl-g" | "x";

const CONFIG_URL = "gtkx:fixture-config";
const RAW_URL = "gtkx:raw";
const CONFIG_SOURCE = [
    'export const applicationId = "org.gtkx.shortcutfixture";',
    'export const resourceBasePath = "/org/gtkx/shortcutfixture";',
    "export const userEventSignals = {};",
    "export const elements = {};",
].join("\n");

registerHooks({
    resolve(specifier, context, nextResolve) {
        if (specifier === "virtual:gtkx-config") {
            return { shortCircuit: true, url: CONFIG_URL };
        }

        if (specifier.endsWith("?raw")) {
            return { shortCircuit: true, url: RAW_URL };
        }

        return nextResolve(specifier, context);
    },
    load(url, context, nextLoad) {
        if (url === CONFIG_URL) {
            return { format: "module", shortCircuit: true, source: CONFIG_SOURCE };
        }

        if (url === RAW_URL) {
            return { format: "module", shortCircuit: true, source: 'export default "";' };
        }

        return nextLoad(url, context);
    },
});

const Gtk = await import("@gtkx/gi/gtk");
const { quit } = await import("@gtkx/runtime");
const { cleanup, screen, userEvent } = await import("@gtkx/testing");
const { shortcutTriggersDemo } = await import("../../src/demos/gestures/shortcut-triggers.js");
const { renderDemo } = await import("../test-utils.js");

const scenario: Scenario = process.env.GTKX_SHORTCUT_SCENARIO === "x" ? "x" : "ctrl-g";
const labelName = scenario === "x" ? "label-x" : "label-ctrl-g";
const keys = scenario === "x" ? "x" : "{Control>}g{/Control}";

await renderDemo(shortcutTriggersDemo);
const label = await screen.findByName(labelName, { as: Gtk.Label });
await userEvent.keyboard(label, keys);
await cleanup();
quit();
