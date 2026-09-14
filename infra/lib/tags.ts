// infra/lib/tags.ts
import { Tags } from 'aws-cdk-lib';
import type { IConstruct } from 'constructs';
import type { EnvName } from './config';

export function applyProjectTags(scope: IConstruct, envName: EnvName): void {
  Tags.of(scope).add('Project', 'ShiftManagementPro');
  Tags.of(scope).add('Environment', envName);
  Tags.of(scope).add('ManagedBy', 'CDK');
}
