const MINIMUM_NODE_MAJOR = 26;
const MINIMUM_NODE_MINOR = 7;
const MINIMUM_NODE_VERSION = "26.7.0";

const assertSupportedNodeVersion = (): void => {
    const [major = 0, minor = 0] = process.versions.node.split(".").map(Number);
    const isSupported = major > MINIMUM_NODE_MAJOR || (major === MINIMUM_NODE_MAJOR && minor >= MINIMUM_NODE_MINOR);

    if (!isSupported) {
        throw new Error(
            `GTKX requires Node.js ${MINIMUM_NODE_VERSION} or newer. Current version: ${process.versions.node}.`,
        );
    }
};

export { assertSupportedNodeVersion, MINIMUM_NODE_VERSION };
