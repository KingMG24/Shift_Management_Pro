import { App } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { AuthStack } from '../lib/auth-stack';

test('creates a user pool with SupportWorker and TeamLeaderAdmin groups and a public client', () => {
  const app = new App();
  const stack = new AuthStack(app, 'TestAuthStack', { envName: 'dev' });
  const template = Template.fromStack(stack);

  template.resourceCountIs('AWS::Cognito::UserPool', 1);
  template.resourceCountIs('AWS::Cognito::UserPoolGroup', 2);
  template.hasResourceProperties('AWS::Cognito::UserPoolGroup', { GroupName: 'SupportWorker' });
  template.hasResourceProperties('AWS::Cognito::UserPoolGroup', { GroupName: 'TeamLeaderAdmin' });
  template.hasResourceProperties('AWS::Cognito::UserPoolClient', {
    GenerateSecret: false,
    ExplicitAuthFlows: ['ALLOW_USER_SRP_AUTH', 'ALLOW_REFRESH_TOKEN_AUTH'],
  });
});
