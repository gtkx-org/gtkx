const errorCode = (error: unknown): string | undefined =>
    error instanceof Error && "code" in error && typeof error.code === "string" ? error.code : undefined;

export { errorCode };
