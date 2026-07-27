import { ESLintUtils, type TSESTree } from "@typescript-eslint/utils";
import { getSection, rankFor, type Section } from "./sections.js";

type MessageIds = "outOfOrder";
type Placement = { section: Section; line: number };
type Misplacement = { statement: TSESTree.ProgramStatement; section: Section; blocker: Placement };

const moduleSectionOrder = ESLintUtils.RuleCreator.withoutDocs<[], MessageIds>({
    meta: {
        type: "suggestion",
        docs: {
            description:
                "Enforce a single top-level layout per module: imports, types, constants, functions, classes, " +
                "side effects, exports",
        },
        messages: {
            outOfOrder:
                "Move this to the {{section}} section: it belongs above the {{blocker}} on line {{line}}. " +
                "Modules read top to bottom as imports, types, constants, functions, classes, side effects, " +
                "exports.",
        },
        schema: [],
    },
    defaultOptions: [],
    create(context) {
        return {
            Program(program): void {
                for (const { statement, section, blocker } of misplaced(program)) {
                    context.report({
                        loc: context.sourceCode.getFirstToken(statement)?.loc ?? statement.loc,
                        messageId: "outOfOrder",
                        data: { section, blocker: blocker.section, line: blocker.line },
                    });
                }
            },
        };
    },
});

const isBlocked = (furthest: Placement | undefined, section: Section): furthest is Placement =>
    furthest !== undefined && rankFor(section) < rankFor(furthest.section);

const advanced = (furthest: Placement | undefined, section: Section, line: number): Placement =>
    furthest !== undefined && rankFor(section) <= rankFor(furthest.section)
        ? furthest
        : { section, line };

const misplaced = (program: TSESTree.Program): Misplacement[] => {
    const found: Misplacement[] = [];
    let furthest: Placement | undefined;

    for (const statement of program.body) {
        const section = getSection(statement);

        if (section === undefined) {
            continue;
        }

        if (isBlocked(furthest, section)) {
            found.push({ statement, section, blocker: furthest });
            continue;
        }

        furthest = advanced(furthest, section, statement.loc.start.line);
    }

    return found;
};

export { moduleSectionOrder };
