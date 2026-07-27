const XDG_DATA_DIRS_DEFAULT = "/usr/local/share:/usr/share";

const prependXdgDataDir = (dir: string, existing: string | undefined): string => {
    const base = existing === undefined || existing.length === 0 ? XDG_DATA_DIRS_DEFAULT : existing;

    if (base.split(":").includes(dir)) {
        return base;
    }

    return `${dir}:${base}`;
};

export { prependXdgDataDir };
