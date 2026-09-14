import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const authorizerContext = event.requestContext.authorizer as { sub?: string; role?: string } | null;
  if (!authorizerContext?.sub || !authorizerContext?.role) {
    return { statusCode: 401, body: JSON.stringify({ message: 'Unauthorized' }) };
  }
  const { sub, role } = authorizerContext;
  return {
    statusCode: 200,
    headers: { 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify({ sub, role }),
  };
}
