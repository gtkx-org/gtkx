import { beforeAll } from "vitest";
import * as Gtk from "../src/generated/gtk/index.js";
import { initRuntime, registerNativeClass } from "../src/index.js";

beforeAll(() => {
    registerNativeClass(Gtk.Application);
    initRuntime();
});
