import cp from "node:child_process";
import { copyFile, rename } from "node:fs/promises";
import { arch } from "node:os";
import { promisify } from "node:util";

const exec = promisify(cp.exec);

const main = async () => {
    await exec("cargo build --message-format=json-render-diagnostics --release > cargo.log");
    await exec("neon dist < cargo.log");

    const dest = `../native-linux-${arch()}/index.node`;
    const tmp = `${dest}.tmp`;
    await copyFile("index.node", tmp);
    await rename(tmp, dest);
};

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
