import { writeFileSync } from "node:fs";

const report = {
    resolved: import.meta.resolve("@gtkx/runtime"),
    execArgv: process.execArgv,
    nodeOptions: process.env.NODE_OPTIONS ?? "",
};

writeFileSync(process.argv[2], JSON.stringify(report));
