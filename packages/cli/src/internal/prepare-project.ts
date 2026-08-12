import { ensureGeneratedIn } from "../codegen/run-codegen.js";
import { resolveCodegenContext } from "../codegen/store-resolver.js";
import { resolveCwd, resolveEntry } from "./entry-arg.js";

type ProjectArgs = { entry?: string; cwd?: string };
type PreparedProject = { cwd: string; entry: string };

const prepareProject = async (args: ProjectArgs, mode: string): Promise<PreparedProject> => {
    const cwd = resolveCwd(args);
    const context = await resolveCodegenContext(cwd, mode);
    const entry = resolveEntry(cwd, args.entry);
    await ensureGeneratedIn(context, { shouldAnnounce: true, mode });

    return { cwd, entry };
};

export { prepareProject };
