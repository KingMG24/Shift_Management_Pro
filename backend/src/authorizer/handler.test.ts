import type { APIGatewayTokenAuthorizerEvent } from 'aws-lambda';

const mockVerify = jest.fn();

jest.mock('aws-jwt-verify', () => ({
  CognitoJwtVerifier: {
    create: jest.fn(() => ({ verify: mockVerify })),
  },
}));

import { handler } from './handler';

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
  mockVerify.mockClear();
});

test('returns an Allow policy with role/sub context for a valid token', async () => {
  mockVerify.mockResolvedValueOnce({
    sub: 'user-123',
    'cognito:groups': ['TeamLeaderAdmin'],
  });

  const result = await handler(baseEvent('valid-token'));

  expect(result.principalId).toBe('user-123');
  expect(result.policyDocument.Statement[0].Effect).toBe('Allow');
  expect((result.policyDocument.Statement[0] as any).Resource).toBe(
    'arn:aws:execute-api:ap-southeast-2:123456789012:abc123/dev/GET/me'
  );
  expect(result.context).toEqual({ role: 'TeamLeaderAdmin', sub: 'user-123' });
});

test('throws Unauthorized for an invalid token', async () => {
  mockVerify.mockRejectedValueOnce(new Error('token expired'));

  await expect(handler(baseEvent('bad-token'))).rejects.toThrow('Unauthorized');
});
