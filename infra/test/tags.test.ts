// infra/test/tags.test.ts
import { App, Stack } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { applyProjectTags } from '../lib/tags';

test('applies Project/Environment/ManagedBy tags to every resource in the stack', () => {
  const app = new App();
  const stack = new Stack(app, 'TestTagsStack');
  new Bucket(stack, 'DummyBucket');

  applyProjectTags(stack, 'dev');

  const template = Template.fromStack(stack);
  template.hasResourceProperties('AWS::S3::Bucket', {
    Tags: [
      { Key: 'Environment', Value: 'dev' },
      { Key: 'ManagedBy', Value: 'CDK' },
      { Key: 'Project', Value: 'ShiftManagementPro' },
    ],
  });
});
