export type EnvName = 'dev' | 'prod';

export function getEnvConfig(envName: EnvName) {
  return {
    envName,
    stackName: (concern: string) => `ShiftManagementPro-${concern}-${envName}`,
  };
}
