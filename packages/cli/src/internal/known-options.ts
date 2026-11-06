import { camelCase, kebabCase } from "@gtkx/utils";
import type { ArgsDef, CommandDef, Resolvable } from "citty";
import { parseArgs, type ParseArgsOptionsConfig } from "node:util";
import { applicationArgsHint, splitApplicationArgs } from "./application-args.js";

type OptionToken = Extract<
    ReturnType<typeof parseArgs<{ tokens: true; strict: false }>>["tokens"][number],
    { kind: "option" }
>;

type CommandShape = Pick<CommandDef, "args" | "subCommands">;

type CommandOptions = {
    names: string[];
    config: ParseArgsOptionsConfig;
    booleans: Set<string>;
};

const HELP_OPTION = "help";
const HELP_SHORT = "h";

const resolveValue = async <T>(value: Resolvable<T>): Promise<T> =>
    typeof value === "function" ? await (value as () => T | Promise<T>)() : await value;

const nameVariants = (name: string): string[] => [...new Set([name, camelCase(name), kebabCase(name)])];

const commandOptions = (args: ArgsDef): CommandOptions => {
    const names: string[] = [];
    const config: ParseArgsOptionsConfig = { [HELP_OPTION]: { type: "boolean", short: HELP_SHORT } };
    const booleans: Set<string> = new Set();

    for (const [name, definition] of Object.entries(args)) {
        if (definition.type === "positional") {
            continue;
        }

        const type = definition.type === "boolean" ? "boolean" : "string";
        const aliases = "alias" in definition && definition.alias !== undefined ? [definition.alias].flat() : [];
        const short = aliases.find((alias) => alias.length === 1);
        names.push(name);

        for (const variant of [...nameVariants(name), ...aliases.filter((alias) => alias.length > 1)]) {
            config[variant] = { type, ...(variant === name && short !== undefined && { short }) };

            if (type === "boolean") {
                booleans.add(variant);
            }
        }
    }

    return { names, config, booleans };
};

const isKnown = (token: OptionToken, options: CommandOptions): boolean =>
    token.name in options.config ||
    (token.rawName.startsWith("--no-") && token.value === undefined && options.booleans.has(token.name.slice(3)));

const editDistance = (from: string, to: string): number => {
    let previous = Array.from({ length: to.length + 1 }, (_, index) => index);

    for (const [row, fromChar] of [...from].entries()) {
        const current = [row + 1];

        for (const [column, toChar] of [...to].entries()) {
            current.push(
                Math.min(
                    (previous[column + 1] ?? 0) + 1,
                    (current[column] ?? 0) + 1,
                    (previous[column] ?? 0) + (fromChar === toChar ? 0 : 1),
                ),
            );
        }

        previous = current;
    }

    return previous[to.length] ?? 0;
};

const closestOption = (name: string, names: string[]): string | undefined => {
    const spelled = kebabCase(name);
    const maxDistance = Math.max(2, Math.floor(spelled.length / 3));
    const ranked = names
        .map((candidate) => ({ candidate, distance: editDistance(spelled, candidate) }))
        .filter(({ distance }) => distance <= maxDistance)
        .sort((left, right) => left.distance - right.distance);

    return ranked[0]?.candidate;
};

const describeUnknown = (token: OptionToken, options: CommandOptions): string => {
    const closest = token.rawName.startsWith("--") ? closestOption(token.name, options.names) : undefined;

    return closest === undefined ? token.rawName : `${token.rawName} (did you mean --${closest}?)`;
};

const listOptions = (names: string[]): string => {
    const flags = names.map((name) => `--${name}`);
    const last = flags.pop();

    if (last === undefined) {
        return "takes no options";
    }

    return `takes ${flags.length === 0 ? last : `${flags.join(", ")} and ${last}`}`;
};

const unknownOptionsError = (
    command: string,
    unknown: OptionToken[],
    options: CommandOptions,
    applicationHint: string | undefined,
): Error => {
    const hint = applicationHint === undefined ? "" : ` ${applicationHint}`;

    return new Error(
        `Unknown option${unknown.length === 1 ? "" : "s"} for ${command}: ` +
            `${unknown.map((token) => describeUnknown(token, options)).join(", ")}. ` +
            `${command} ${listOptions(options.names)}; run "${command} --help" for details.${hint}`,
    );
};

const assertKnownOptions = async (
    command: string,
    definition: CommandShape,
    rawArgs: string[],
    applicationCommand: string | undefined,
): Promise<void> => {
    const options = commandOptions(await resolveValue(definition.args ?? {}));
    const { tokens } = parseArgs({
        args: rawArgs,
        options: options.config,
        allowPositionals: true,
        tokens: true,
        strict: false,
    });
    const subCommands = await resolveValue(definition.subCommands ?? {});
    const [firstPositional] = tokens.filter((token) => token.kind === "positional");
    const subCommand =
        firstPositional !== undefined && Object.hasOwn(subCommands, firstPositional.value)
            ? { name: firstPositional.value, index: firstPositional.index }
            : undefined;
    const unknown = tokens.filter(
        (token): token is OptionToken =>
            token.kind === "option" && token.index < (subCommand?.index ?? rawArgs.length) && !isKnown(token, options),
    );
    const [first] = unknown;

    if (first !== undefined) {
        const passed = rawArgs[first.index] ?? first.rawName;
        const hint = applicationCommand === undefined ? undefined : applicationArgsHint(applicationCommand, passed);

        throw unknownOptionsError(command, unknown, options, hint);
    }

    const selected = subCommand === undefined ? undefined : subCommands[subCommand.name];

    if (subCommand !== undefined && selected !== undefined) {
        await assertKnownOptions(
            `${command} ${subCommand.name}`,
            await resolveValue(selected),
            rawArgs.slice(subCommand.index + 1),
            undefined,
        );
    }
};

/**
 * Makes a `gtkx` command reject options that neither it nor the subcommand it runs defines, before anything
 * runs. Arguments after `--` are left to the application.
 */
const withKnownOptions = <T extends ArgsDef>(
    name: string,
    command: CommandDef<T>,
    forwardsApplicationArgs = false,
): CommandDef<T> => ({
    ...command,
    setup: async (context): Promise<void> => {
        await assertKnownOptions(
            `gtkx ${name}`,
            command,
            splitApplicationArgs(context.rawArgs).cliArgs,
            forwardsApplicationArgs ? name : undefined,
        );
        await command.setup?.(context);
    },
});

export { withKnownOptions };
