type AssetEmitter = {
    emitFile: (file: { type: "asset"; fileName: string; source: Buffer | string }) => void;
};

export { type AssetEmitter };
