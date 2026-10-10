import assert from 'node:assert/strict';
import test from 'node:test';
import { summarizeReactions } from '../lib/chat-reactions';
test('reactions aggregate per message and mark the viewer reaction', () => {
 const rows = [
  {value:{messageId:'one',userId:'me',emoji:'❤️'}},
  {value:{messageId:'one',userId:'colleague',emoji:'❤️'}},
  {value:{messageId:'one',userId:'other',emoji:'👍'}},
  {value:{messageId:'two',userId:'me',emoji:'🔥'}},
 ];
 assert.deepEqual(summarizeReactions(rows,'one','me',[]),[{emoji:'❤️',count:2,mine:true},{emoji:'👍',count:1,mine:false}]);
});
test('blocked users, malformed values and unsupported emoji stay hidden', () => {
 assert.deepEqual(summarizeReactions([{value:null},{value:{messageId:'one',userId:'blocked',emoji:'❤️'}},{value:{messageId:'one',userId:'other',emoji:'invalid'}}], 'one','me',['blocked']),[]);
});
