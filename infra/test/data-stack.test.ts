// infra/test/data-stack.test.ts
import { App } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { DataStack } from '../lib/data-stack';

test('creates a single table with PK/SK and GSI1-GSI4', () => {
  const app = new App();
  const stack = new DataStack(app, 'TestDataStack', { envName: 'dev' });
  const template = Template.fromStack(stack);
  const json = template.toJSON();

  const tableResource = Object.values(json.Resources).find(
    (r: any) => r.Type === 'AWS::DynamoDB::Table'
  ) as any;

  expect(tableResource).toBeDefined();
  expect(tableResource.Properties.KeySchema).toEqual([
    { AttributeName: 'PK', KeyType: 'HASH' },
    { AttributeName: 'SK', KeyType: 'RANGE' },
  ]);
  expect(tableResource.Properties.BillingMode).toBe('PAY_PER_REQUEST');

  const gsiNames = tableResource.Properties.GlobalSecondaryIndexes.map(
    (g: any) => g.IndexName
  );
  expect(gsiNames.sort()).toEqual(['GSI1', 'GSI2', 'GSI3', 'GSI4']);
});
