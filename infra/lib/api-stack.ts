import * as path from 'path';
import { Stack, StackProps, Duration, CfnOutput } from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as lambda from 'aws-cdk-lib/aws-lambda';
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
      runtime: lambda.Runtime.NODEJS_24_X,
      environment: {
        USER_POOL_ID: userPool.userPoolId,
        USER_POOL_CLIENT_ID: userPoolClient.userPoolClientId,
      },
    });

    const tokenAuthorizer = new apigateway.TokenAuthorizer(this, 'Authorizer', {
      handler: authorizerFn,
      resultsCacheTtl: Duration.seconds(0),
    });

    const healthFn = new NodejsFunction(this, 'HealthFunction', {
      entry: path.join(__dirname, '../../backend/src/health/handler.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_24_X,
    });

    const meFn = new NodejsFunction(this, 'MeFunction', {
      entry: path.join(__dirname, '../../backend/src/me/handler.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_24_X,
    });

    const api = new apigateway.RestApi(this, 'Api', {
      restApiName: `ShiftManagementPro-Api-${envName}`,
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowHeaders: [...apigateway.Cors.DEFAULT_HEADERS],
      },
    });

    api.root
      .addResource('health')
      .addMethod('GET', new apigateway.LambdaIntegration(healthFn));

    api.root.addResource('me').addMethod('GET', new apigateway.LambdaIntegration(meFn), {
      authorizer: tokenAuthorizer,
      authorizationType: apigateway.AuthorizationType.CUSTOM,
    });

    this.apiUrl = api.url;
    new CfnOutput(this, 'ApiUrl', { value: this.apiUrl });
    applyProjectTags(this, envName);
  }
}
