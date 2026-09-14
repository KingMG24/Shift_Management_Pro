import { handler } from './handler';

test('returns 200 with status ok', async () => {
  const result = await handler();
  expect(result.statusCode).toBe(200);
  expect(JSON.parse(result.body)).toEqual({ status: 'ok' });
});
