const quote = (value) => `'${value.replaceAll("'", "'\\''")}'`;

const wrapCommand = (command) => {
    const value = Array.isArray(command) ? command.join(" ") : command;

    if (value.includes("{args}") || value.includes("{args.")) {
        throw new Error("Container task commands must forward arguments without Nx argument interpolation");
    }

    return `node "$NX_WORKSPACE_ROOT/scripts/ci/run.mjs" ${quote(value)}`;
};

const wrapOptions = (options) => {
    if (options === undefined) {
        return undefined;
    }

    return {
        ...options,
        ...(options.command === undefined ? {} : { command: wrapCommand(options.command) }),
        ...(options.commands === undefined
            ? {}
            : {
                  commands: options.commands.map((command) =>
                      typeof command === "string"
                          ? wrapCommand(command)
                          : { ...command, command: wrapCommand(command.command) },
                  ),
              }),
    };
};

const wrapTarget = (target) => ({
    ...target,
    ...(target.command === undefined && target.options?.command === undefined && target.options?.commands === undefined
        ? {}
        : { inputs: [...(target.inputs ?? ["default", "^default"]), "{workspaceRoot}/scripts/ci/**/*"] }),
    ...(target.command === undefined ? {} : { command: wrapCommand(target.command) }),
    ...(target.options === undefined ? {} : { options: wrapOptions(target.options) }),
    ...(target.configurations === undefined
        ? {}
        : {
              configurations: Object.fromEntries(
                  Object.entries(target.configurations).map(([name, options]) => [name, wrapOptions(options)]),
              ),
          }),
});

export const wrapPlugin = ([pattern, createNodes]) => [
    pattern,
    async (files, options, context) => {
        const results = await createNodes(files, options, context);

        return results.map(([file, result]) => [
            file,
            {
                ...result,
                ...(result.projects === undefined
                    ? {}
                    : {
                          projects: Object.fromEntries(
                              Object.entries(result.projects).map(([root, project]) => [
                                  root,
                                  {
                                      ...project,
                                      ...(project.targets === undefined
                                          ? {}
                                          : {
                                                targets: Object.fromEntries(
                                                    Object.entries(project.targets).map(([name, target]) => [
                                                        name,
                                                        wrapTarget(target),
                                                    ]),
                                                ),
                                            }),
                                  },
                              ]),
                          ),
                      }),
            },
        ]);
    },
];
