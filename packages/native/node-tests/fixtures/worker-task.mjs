import * as GObject from "@gtkx/gi/gobject";
import * as Regress from "@gtkx/gi/regress";
import { liveWrapperCount, quit } from "@gtkx/native";
import { parentPort, workerData } from "node:worker_threads";

const obj = new Regress.TestObj({ int: 21 });
obj.setBare(new GObject.Object({}));
obj.setString("worker");

const report = {
    doubled: Regress.testInt32(21) + obj.int,
    string: obj.getString(),
    wrappers: liveWrapperCount() > 0,
};

if (workerData === "linger") {
    parentPort.on("message", () => {
        quit();
        parentPort.postMessage("torn down");
    });
}

parentPort.postMessage(report);
