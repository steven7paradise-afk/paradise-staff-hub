import assert from 'node:assert/strict';
import test from 'node:test';
import { validateChatFile, boundedJSON, MAX_CHAT_FILE } from '../lib/chat-files';
test('voice containers use audio MIME and reject renamed text', () => {
  for (const [name, bytes, mime] of [
    ['voice.m4a', Buffer.concat([Buffer.from([0,0,0,24]), Buffer.from('ftypM4A ')]), 'audio/mp4'],
    ['voice.webm', Buffer.concat([Buffer.from([0x1a,0x45,0xdf,0xa3]), Buffer.from('webm')]), 'audio/webm'],
    ['voice.ogg', Buffer.from('OggS0000OpusHead'), 'audio/ogg'],
  ] as const) {
    assert.equal(validateChatFile(name, bytes.toString('base64')).mediaType, mime);
    assert.throws(() => validateChatFile(name, Buffer.from('not audio').toString('base64')));
  }
});
test('attachments retain size, base64 and filename validation', () => {
  assert.throws(() => validateChatFile('file.txt', Buffer.alloc(MAX_CHAT_FILE + 1, 65).toString('base64')));
  assert.throws(() => validateChatFile('file.txt', 'invalid%%%'));
  assert.equal(validateChatFile('../file.txt', Buffer.from('test').toString('base64')).filename, '.._file.txt');
});
test('streamed body is bounded before parsing', async () => {
  await assert.rejects(boundedJSON(new Request('https://example.test', {method:'POST',body:'x'.repeat(30)}), 20), /troppo grande/);
  assert.deepEqual(await boundedJSON(new Request('https://example.test', {method:'POST',body:'{"roomId":"test"}'}), 100), {roomId:'test'});
});
