// infra/test/api-stack.test.ts
import { App, Stack } from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import { ApiStack } from '../lib/api-stack';

test('creates a REST API with a public /health and an authorizer-protected /me', () => {
  const app = new App();
  const authHost = new Stack(app, 'AuthHostStack');
  const userPool = new cognito.UserPool(authHost, 'UP');
  const userPoolClient = new cognito.UserPoolClient(authHost, 'UPC', { userPool });

  const stack = new ApiStack(app, 'TestApiStack', {
    envName: 'dev',
    userPool,
    userPoolClient,
  });
  const template = Template.fromStack(stack);

  template.resourceCountIs('AWS::ApiGateway::RestApi', 1);
  template.hasResourceProperties('AWS::ApiGateway::Method', {
    HttpMethod: 'GET',
    AuthorizationType: 'NONE',
  });
  template.hasResourceProperties('AWS::ApiGateway::Method', {
    HttpMethod: 'GET',
    AuthorizationType: 'CUSTOM',
  });
  template.hasResourceProperties('AWS::ApiGateway::Authorizer', {
    Type: 'TOKEN',
  });
});
