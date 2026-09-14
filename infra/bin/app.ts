#!/usr/bin/env node
import { App } from 'aws-cdk-lib';
import { getEnvConfig, type EnvName } from '../lib/config';
import { AuthStack } from '../lib/auth-stack';
import { DataStack } from '../lib/data-stack';
import { StorageStack } from '../lib/storage-stack';
import { ApiStack } from '../lib/api-stack';
import { FrontendStack } from '../lib/frontend-stack';

const app = new App();

const envNames: EnvName[] = ['dev', 'prod'];

for (const envName of envNames) {
  const { stackName } = getEnvConfig(envName);

  const authStack = new AuthStack(app, stackName('Auth'), { envName });
  new DataStack(app, stackName('Data'), { envName });
  new StorageStack(app, stackName('Storage'), { envName });
  new ApiStack(app, stackName('Api'), {
    envName,
    userPool: authStack.userPool,
    userPoolClient: authStack.userPoolClient,
  });
  new FrontendStack(app, stackName('Frontend'), { envName });
}
