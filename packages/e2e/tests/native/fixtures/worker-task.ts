import * as GObject from "@gtkx/gi/gobject";
import * as Regress from "@gtkx/gi/regress";
import { quit } from "@gtkx/native";
import { parentPort, workerData } from "node:worker_threads";

if (parentPort === null) {
    throw new Error("The worker fixture must run as a worker thread");
}

const port = parentPort;

const obj = new Regress.TestObj({ int: 21 });
obj.setBare(new GObject.Object({}));
obj.setString("worker");

const report = {
    doubled: Regress.testInt32(21) + obj.int,
    string: obj.getString(),
    bare: obj.bare instanceof GObject.Object,
};

if (workerData === "linger") {
    port.on("message", () => {
        quit();
        port.postMessage("torn down");
    });
}

port.postMessage(report);
