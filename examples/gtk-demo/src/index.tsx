import * as Gtk from "@gtkx/ffi/gtk";
import { render } from "@gtkx/react";
import { App } from "./app.js";

const app = new Gtk.Application(undefined, "org.gtkx.gtk-demo");
render(<App />, app);
