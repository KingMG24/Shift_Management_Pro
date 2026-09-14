import type {
  APIGatewayAuthorizerResult,
  APIGatewayTokenAuthorizerEvent,
} from 'aws-lambda';
import { CognitoJwtVerifier } from 'aws-jwt-verify';

const verifier = CognitoJwtVerifier.create({
  userPoolId: process.env.USER_POOL_ID as string,
  clientId: process.env.USER_POOL_CLIENT_ID as string,
  tokenUse: 'access',
});

export async function handler(
  event: APIGatewayTokenAuthorizerEvent
): Promise<APIGatewayAuthorizerResult> {
  try {
    const payload = await verifier.verify(event.authorizationToken);
    const role = (payload['cognito:groups'] as string[] | undefined)?.[0] ?? 'Unknown';

    return {
      principalId: payload.sub,
      policyDocument: {
        Version: '2012-10-17',
        Statement: [
          {
            Action: 'execute-api:Invoke',
            Effect: 'Allow',
            Resource: event.methodArn,
          } as any,
        ],
      },
      context: { role, sub: payload.sub },
    };
  } catch {
    throw new Error('Unauthorized');
  }
}
