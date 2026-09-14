import type { APIGatewayProxyEvent } from 'aws-lambda';
import { handler } from './handler';

function eventWithAuthorizerContext(context: Record<string, string>): APIGatewayProxyEvent {
  return {
    requestContext: { authorizer: context },
  } as unknown as APIGatewayProxyEvent;
}

test('echoes the role and sub set by the authorizer', async () => {
  const result = await handler(
    eventWithAuthorizerContext({ role: 'SupportWorker', sub: 'user-456' })
  );

  expect(result.statusCode).toBe(200);
  expect(JSON.parse(result.body)).toEqual({ sub: 'user-456', role: 'SupportWorker' });
});
