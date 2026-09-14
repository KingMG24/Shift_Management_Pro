import type { APIGatewayProxyResult } from 'aws-lambda';

export async function handler(): Promise<APIGatewayProxyResult> {
  return { statusCode: 200, body: JSON.stringify({ status: 'ok' }) };
}
