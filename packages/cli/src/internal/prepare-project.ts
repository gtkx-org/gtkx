import { ensureGeneratedIn } from "../codegen/run-codegen.js";
import { type CodegenContext, resolveCodegenContext } from "../codegen/store-resolver.js";
import { resolveCwd, resolveEntry } from "./entry-arg.js";

type ProjectArgs = { entry?: string; cwd?: string };
type PreparedProject = { cwd: string; entry: string };
type ResolvedProject = PreparedProject & { context: CodegenContext };

const resolveProject = async (args: ProjectArgs, mode: string): Promise<ResolvedProject> => {
    const cwd = resolveCwd(args);
    const context = await resolveCodegenContext(cwd, mode);

    return { cwd, entry: resolveEntry(cwd, args.entry), context };
};

const prepareProject = async (args: ProjectArgs, mode: string): Promise<PreparedProject> => {
    const { cwd, entry, context } = await resolveProject(args, mode);
    await ensureGeneratedIn(context, { shouldAnnounce: true, mode });

    return { cwd, entry };
};

export { prepareProject, resolveProject };
