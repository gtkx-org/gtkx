import { execSync } from "node:child_process";
import { copyFileSync, renameSync } from "node:fs";
import { arch } from "node:os";

execSync("cargo build --message-format=json-render-diagnostics --release > cargo.log", { stdio: "inherit" });
execSync("neon dist < cargo.log", { stdio: "inherit" });

const dest = `../native-linux-${arch()}/index.node`;
const tmp = `${dest}.tmp`;
copyFileSync("index.node", tmp);
renameSync(tmp, dest);
