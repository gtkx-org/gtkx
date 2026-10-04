import { execFileSync } from "node:child_process";
import { type CliProject, TSX_LOADER } from "./cli-project.js";
import { typecheckFile } from "./type-consumer.js";

const GIO_CONFIG = `export default {
    applicationId: "com.gtkx.gioprobe",
    libraries: ["Gio-2.0"],
};
`;
const ORIENTABLE_CONFIG = `export default {
    applicationId: "com.gtkx.gtkprobe",
};
`;

const typecheckProject = (project: CliProject, file = "probe.ts"): number =>
    typecheckFile(project, file, [
        "--module", "NodeNext",
        "--moduleResolution", "NodeNext",
        "--skipLibCheck", "true",
    ]);

const evaluateProject = (project: { root: string }, source: string): string =>
    execFileSync(
        process.execPath,
        [
            "--import", TSX_LOADER,
            "--input-type=module",
            "--eval",
            source,
        ],
        {
            cwd: project.root,
            encoding: "utf8",
            stdio: ["ignore", "pipe", "pipe"],
        },
    );

export { evaluateProject, GIO_CONFIG, ORIENTABLE_CONFIG, typecheckProject };
