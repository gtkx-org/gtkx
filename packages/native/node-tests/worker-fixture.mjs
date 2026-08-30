import { parentPort, workerData } from "node:worker_threads";
import * as native from "../main.js";

const UINT32 = { kind: "uint32" };
const memory = native.alloc(4);

native.write(memory, UINT32, 0, 37);

if (workerData === "wrapper-terminate") {
    const GOBJECT = "libgobject-2.0.so.0";
    const gobjectType = native.resolveType(GOBJECT, "g_object_get_type");
    const wrapper = {};

    native.newObject(gobjectType, [], [], wrapper, (handle, associated) => {
        native.setWrapper(handle, associated);
    });
}

parentPort.postMessage(native.read(memory, UINT32, 0));

if (workerData === "graceful") {
    native.keepAlive(false);
    native.quit();
} else if (workerData.endsWith("terminate")) {
    setInterval(() => 0, 1000);
}
