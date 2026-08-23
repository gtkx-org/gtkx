const DIGIT_SEGMENT = /(?<=[a-z])(?=\d)/g;

function dashedVariants(canonical: string): string[] {
    const [head, ...tail] = canonical.split(DIGIT_SEGMENT);
    let variants = [head ?? canonical];

    for (const part of tail) {
        variants = variants.flatMap((variant) => [`${variant}${part}`, `${variant}-${part}`]);
    }

    return variants;
}

export { dashedVariants };
