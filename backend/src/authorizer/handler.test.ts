import type { APIGatewayTokenAuthorizerEvent } from 'aws-lambda';

jest.mock('aws-jwt-verify', () => ({
  CognitoJwtVerifier: {
    create: jest.fn(),
  },
}));

import { CognitoJwtVerifier } from 'aws-jwt-verify';
import { handler } from './handler';

const mockCreate = CognitoJwtVerifier.create as jest.Mock;

function baseEvent(token: string): APIGatewayTokenAuthorizerEvent {
  return {
    type: 'TOKEN',
    authorizationToken: token,
    methodArn: 'arn:aws:execute-api:ap-southeast-2:123456789012:abc123/dev/GET/me',
  };
}

beforeEach(() => {
  process.env.USER_POOL_ID = 'ap-southeast-2_TESTPOOL';
  process.env.USER_POOL_CLIENT_ID = 'test-client-id';
});

test('returns an Allow policy with role/sub context for a valid token', async () => {
  mockCreate.mockReturnValue({
    verify: jest.fn().mockResolvedValue({
      sub: 'user-123',
      'cognito:groups': ['TeamLeaderAdmin'],
    }),
  });

  const result = await handler(baseEvent('valid-token'));

  expect(result.principalId).toBe('user-123');
  expect(result.policyDocument.Statement[0].Effect).toBe('Allow');
  expect(result.policyDocument.Statement[0].Resource).toBe(
    'arn:aws:execute-api:ap-southeast-2:123456789012:abc123/dev/GET/me'
  );
  expect(result.context).toEqual({ role: 'TeamLeaderAdmin', sub: 'user-123' });
});

test('throws Unauthorized for an invalid token', async () => {
  mockCreate.mockReturnValue({
    verify: jest.fn().mockRejectedValue(new Error('token expired')),
  });

  await expect(handler(baseEvent('bad-token'))).rejects.toThrow('Unauthorized');
});
