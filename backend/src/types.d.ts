import type { APIGatewayAuthorizerResult, APIGatewayTokenAuthorizerEvent } from 'aws-lambda';

declare global {
  namespace AWS {
    namespace Lambda {
      interface APIGatewayAuthorizerResultWithResource extends APIGatewayAuthorizerResult {
        policyDocument: {
          Version: string;
          Statement: Array<{
            Action: string | string[];
            Effect: 'Allow' | 'Deny';
            Resource: string | string[];
          }>;
        };
        context?: Record<string, any>;
      }
    }
  }
}

declare module 'aws-lambda' {
  interface APIGatewayAuthorizerResult {
    policyDocument: {
      Version: string;
      Statement: Array<{
        Action: string | string[];
        Effect: 'Allow' | 'Deny';
        Resource?: string | string[];
      }>;
    };
  }
}
