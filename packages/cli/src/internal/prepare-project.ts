import { ensureGeneratedIn } from "../codegen/run-codegen.js";
import { type CodegenContext, resolveCodegenContext } from "../codegen/store-resolver.js";
import { deployOutDirFor } from "./deploy-out-dir.js";
import { resolveCwd, resolveEntry } from "./entry-arg.js";

type ProjectArgs = { entry?: string; cwd?: string; config?: string };
type PreparedProject = {
    cwd: string;
    entry: string;
    configFile: string;
    configDependencies: string[];
    deployOutDir: string;
};
type ResolvedProject = PreparedProject & { context: CodegenContext };

const resolveProject = async (args: ProjectArgs, mode: string): Promise<ResolvedProject> => {
    const cwd = resolveCwd(args);
    const context = await resolveCodegenContext(cwd, { mode, configFile: args.config });

    return {
        cwd,
        entry: resolveEntry(cwd, args.entry),
        configFile: context.configFile,
        configDependencies: context.configDependencies,
        deployOutDir: deployOutDirFor(cwd, context.config.deploy?.outDir),
        context,
    };
};

const prepareProject = async (args: ProjectArgs, mode: string): Promise<PreparedProject> => {
    const { context, ...project } = await resolveProject(args, mode);
    await ensureGeneratedIn(context, { shouldAnnounce: true, mode });

    return project;
};

export { prepareProject, resolveProject };
