const DEFAULT_PROGRAM_NAME = "gtkx";

const programName = (applicationId: string | null): string => applicationId?.split(".").at(-1) ?? DEFAULT_PROGRAM_NAME;

export { programName };
