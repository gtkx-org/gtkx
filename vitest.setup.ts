import { afterAll, beforeAll } from "vitest";
import * as Gtk from "./packages/ffi/src/generated/gtk/index.js";
import { registerType, start, stop } from "./packages/ffi/src/index.js";

const toAppId = (name: string) => {
    return `com.gtkx.${name.replace(/[^a-zA-Z0-9]/g, "_")}`;
};

beforeAll((context) => {
    registerType(Gtk.Application);
    start(toAppId(context.name));
});

afterAll(() => {
    stop();
});
