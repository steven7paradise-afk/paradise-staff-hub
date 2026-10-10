import assert from 'node:assert/strict';
import test from 'node:test';
import { readWebResponse, WebApiError, connectionMessage } from '../lib/web-api-response';
test('proxy text and invalid success payloads become recoverable errors', async () => {
 for (const response of [new Response('Bad Gateway', {status:502}), new Response('<html>Unavailable</html>',{status:503}), new Response('invalid'), new Response('null')])
 await assert.rejects(readWebResponse(response), e => e instanceof WebApiError && e.temporary && e.message === connectionMessage);
});
test('authentication errors retain status and valid responses remain unchanged', async () => {
 await assert.rejects(readWebResponse(new Response('{"error":"Accedi"}',{status:401})), e => e instanceof WebApiError && e.status === 401 && !e.temporary);
 assert.deepEqual(await readWebResponse(new Response('{"rooms":[]}')), {rooms:[]});
});
