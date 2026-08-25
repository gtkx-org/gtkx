const resourceBasePath = (applicationId: string): string => `/${applicationId.replaceAll(".", "/")}`;

export { resourceBasePath };
