import { Stack, StackProps } from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import type { Construct } from 'constructs';
import type { EnvName } from './config';
import { applyProjectTags } from './tags';

export interface AuthStackProps extends StackProps {
  envName: EnvName;
}

export class AuthStack extends Stack {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;

  constructor(scope: Construct, id: string, props: AuthStackProps) {
    super(scope, id, props);
    const { envName } = props;

    this.userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: `ShiftManagementPro-${envName}`,
      selfSignUpEnabled: false,
      signInAliases: { email: true },
    });

    new cognito.CfnUserPoolGroup(this, 'SupportWorkerGroup', {
      userPoolId: this.userPool.userPoolId,
      groupName: 'SupportWorker',
    });
    new cognito.CfnUserPoolGroup(this, 'TeamLeaderAdminGroup', {
      userPoolId: this.userPool.userPoolId,
      groupName: 'TeamLeaderAdmin',
    });

    this.userPoolClient = new cognito.UserPoolClient(this, 'UserPoolClient', {
      userPool: this.userPool,
      generateSecret: false,
      authFlows: { userSrp: true },
    });

    applyProjectTags(this, envName);
  }
}
