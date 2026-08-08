type AssetEmitter = {
    emitFile: (file: { type: "asset"; fileName: string; source: Buffer }) => void;
};

export { type AssetEmitter };
