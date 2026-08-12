import { ensureGenerated } from "../codegen/run-codegen.js";
import { resolveCwd, resolveEntry } from "./entry-arg.js";

type ProjectArgs = { entry?: string; cwd?: string };
type PreparedProject = { cwd: string; entry: string };

const prepareProject = async (args: ProjectArgs, mode: string): Promise<PreparedProject> => {
    const cwd = resolveCwd(args);
    await ensureGenerated(cwd, { shouldAnnounce: true, mode });

    return { cwd, entry: resolveEntry(cwd, args.entry) };
};

export { prepareProject };
