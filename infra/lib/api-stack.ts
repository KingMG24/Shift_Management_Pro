import * as path from 'path';
import { Stack, StackProps, Duration } from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import type { Construct } from 'constructs';
import type { EnvName } from './config';
import { applyProjectTags } from './tags';

export interface ApiStackProps extends StackProps {
  envName: EnvName;
  userPool: cognito.UserPool;
  userPoolClient: cognito.UserPoolClient;
}

export class ApiStack extends Stack {
  public readonly apiUrl: string;

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);
    const { envName, userPool, userPoolClient } = props;

    const authorizerFn = new NodejsFunction(this, 'AuthorizerFunction', {
      entry: path.join(__dirname, '../../backend/src/authorizer/handler.ts'),
      handler: 'handler',
      environment: {
        USER_POOL_ID: userPool.userPoolId,
        USER_POOL_CLIENT_ID: userPoolClient.userPoolClientId,
      },
    });

    const tokenAuthorizer = new apigateway.TokenAuthorizer(this, 'Authorizer', {
      handler: authorizerFn,
      resultsCacheTtl: Duration.minutes(5),
    });

    const healthFn = new NodejsFunction(this, 'HealthFunction', {
      entry: path.join(__dirname, '../../backend/src/health/handler.ts'),
      handler: 'handler',
    });

    const meFn = new NodejsFunction(this, 'MeFunction', {
      entry: path.join(__dirname, '../../backend/src/me/handler.ts'),
      handler: 'handler',
    });

    const api = new apigateway.RestApi(this, 'Api', {
      restApiName: `ShiftManagementPro-Api-${envName}`,
    });

    api.root
      .addResource('health')
      .addMethod('GET', new apigateway.LambdaIntegration(healthFn));

    api.root.addResource('me').addMethod('GET', new apigateway.LambdaIntegration(meFn), {
      authorizer: tokenAuthorizer,
      authorizationType: apigateway.AuthorizationType.CUSTOM,
    });

    this.apiUrl = api.url;
    applyProjectTags(this, envName);
  }
}
