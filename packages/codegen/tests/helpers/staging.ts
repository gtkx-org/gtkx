const DEAD_OWNER_PID = 2_147_483_647;

const strandedStagingName = (target: string): string => `${target}.tmp-${String(DEAD_OWNER_PID)}-killed`;
const runningStagingName = (target: string): string => `${target}.tmp-${String(process.pid)}-running`;
const legacyStagingName = (target: string): string => `${target}.tmp-orphan`;

export { legacyStagingName, runningStagingName, strandedStagingName };
