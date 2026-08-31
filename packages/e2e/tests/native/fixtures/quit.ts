import * as GObject from "@gtkx/gi/gobject";
import { init, keepAlive, quit } from "@gtkx/native";

const SETTLE_MS = 100;
const held = new GObject.Object({});

init();

process.stdout.write(`OBJECT ${held instanceof GObject.Object ? "built" : "missing"}\n`);

keepAlive(true);

setTimeout(() => {
    quit();
    quit();
    keepAlive(true);
    process.stdout.write("QUIT\n");
}, SETTLE_MS);
