import { Stack, StackProps, Aws } from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import type { Construct } from 'constructs';
import type { EnvName } from './config';
import { applyProjectTags } from './tags';

export interface StorageStackProps extends StackProps {
  envName: EnvName;
}

export class StorageStack extends Stack {
  public readonly documentsBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: StorageStackProps) {
    super(scope, id, props);
    const { envName } = props;

    this.documentsBucket = new s3.Bucket(this, 'DocumentsBucket', {
      bucketName: `shiftmanagementpro-documents-${envName}-${Aws.ACCOUNT_ID}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
    });

    applyProjectTags(this, envName);
  }
}
