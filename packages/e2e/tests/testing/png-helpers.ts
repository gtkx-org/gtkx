const decodePngSize = (base64Data: string): { width: number; height: number } => {
    const bytes = Buffer.from(base64Data, "base64");

    return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
};

export { decodePngSize };
