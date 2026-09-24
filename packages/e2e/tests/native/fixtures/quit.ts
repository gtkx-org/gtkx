import * as GObject from "@gtkx/gi/gobject";
import { init, keepAlive, quit } from "@gtkx/native";

const held = new GObject.Object({});

init();

process.stdout.write(`OBJECT ${held instanceof GObject.Object ? "built" : "missing"}\n`);

keepAlive(true);
quit();
quit();
keepAlive(true);
process.stdout.write("QUIT\n");
