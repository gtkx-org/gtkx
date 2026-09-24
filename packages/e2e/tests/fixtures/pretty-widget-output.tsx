import { registerHooks } from "node:module";

type Scenario = "debug" | "logWidget";

const CONFIG_URL = "gtkx:fixture-config";
const CONFIG_SOURCE = [
    'export const applicationId = "org.gtkx.e2e";',
    'export const resourceBasePath = "/org/gtkx/e2e";',
    "export const userEventSignals = {};",
    "export const elements = {};",
].join("\n");

registerHooks({
    resolve(specifier, context, nextResolve) {
        return specifier === "virtual:gtkx-config"
            ? { shortCircuit: true, url: CONFIG_URL }
            : nextResolve(specifier, context);
    },
    load(url, context, nextLoad) {
        return url === CONFIG_URL
            ? { format: "module", shortCircuit: true, source: CONFIG_SOURCE }
            : nextLoad(url, context);
    },
});

const Gtk = await import("@gtkx/gi/gtk");
const { GtkBox, GtkButton } = await import("@gtkx/jsx/gtk");
const { quit } = await import("@gtkx/runtime");
const { cleanup, logWidget, render, screen } = await import("@gtkx/testing");

const printSection = (name: string, print: () => void): void => {
    process.stdout.write(`BEGIN ${name}\n`);
    print();
    process.stdout.write(`END ${name}\n`);
};

const logWidgetOutput = async (): Promise<void> => {
    const host = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL });
    host.setName("log-root");
    const { container } = await render(
        <GtkBox orientation={Gtk.Orientation.VERTICAL}>
            <GtkButton label="One" />
            <GtkButton label="Two" />
        </GtkBox>,
        { baseElement: host, container: host },
    );

    printSection("single", () => {
        logWidget(container, { shouldHighlight: false });
    });
    printSection("list", () => {
        logWidget([container, container], { shouldHighlight: false });
    });
    printSection("empty", () => {
        logWidget(container, { maxLength: 0 });
    });
};

const debugOutput = async (): Promise<void> => {
    const host = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL });
    const { container, debug } = await render(<GtkButton label="Default" />, {
        baseElement: host,
        container: host,
    });

    printSection("result", () => {
        debug(undefined, { shouldHighlight: false });
    });
    printSection("empty", () => {
        debug(container, { maxLength: 0 });
    });
    printSection("screen", () => {
        screen.debug(undefined, { shouldHighlight: false });
    });
};

const run = async (scenario: Scenario): Promise<void> => {
    if (scenario === "logWidget") {
        await logWidgetOutput();
    } else {
        await debugOutput();
    }

    await cleanup();
    quit();
};

await run(process.argv[2] === "logWidget" ? "logWidget" : "debug");
