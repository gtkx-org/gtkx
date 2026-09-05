import * as Gtk from "@gtkx/gi/gtk";
import { onLog } from "@gtkx/native";
import { expect, test } from "vitest";

type LogRecord = { level: string; domain: string; message: string };

Gtk.init();

const provokeCssWarning = (selector: string): void => {
    Gtk.CssProvider.new().loadFromString(`${selector} { gtkx-not-a-property: value; }`);
};

test("a real GTK warning reaches a JavaScript log listener", async () => {
    const records: LogRecord[] = [];
    const subscription = onLog((level, domain, message) => {
        records.push({ level, domain, message });
    });

    try {
        provokeCssWarning("gtkx-log-listener-happy");
        await expect.poll(() => records.some(({ level, domain }) => level === "warning" && domain === "Gtk"))
            .toBe(true);
    } finally {
        subscription.unsubscribe();
    }

    const warning = records.find(({ level, domain }) => level === "warning" && domain === "Gtk");

    expect(warning).toBeDefined();
    expect(warning?.message.length).toBeGreaterThan(0);
});

test("an unsubscribed listener ignores later GTK warnings", async () => {
    let removedCalls = 0;
    let retainedCalls = 0;
    const removed = onLog(() => {
        removedCalls += 1;
    });
    const retained = onLog(() => {
        retainedCalls += 1;
    });

    removed.unsubscribe();
    removed.unsubscribe();

    try {
        provokeCssWarning("gtkx-log-listener-edge");
        await expect.poll(() => retainedCalls).toBeGreaterThan(0);
    } finally {
        retained.unsubscribe();
    }

    expect(removedCalls).toBe(0);
    expect(retainedCalls).toBeGreaterThan(0);
});

test("a non-function log listener throws", () => {
    expect(() => {
        (onLog as (listener: unknown) => unknown)(null);
    }).toThrow();
});
