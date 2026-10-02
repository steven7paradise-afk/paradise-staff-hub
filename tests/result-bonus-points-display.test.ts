import test from 'node:test';
import assert from 'node:assert/strict';
import { formatResultBonusPoints, resultBonusNotificationText } from '../lib/result-bonus-points-display';
test('daily awards display numeric points including singular and decimals',()=>{
 assert.equal(formatResultBonusPoints(5),'5 punti'); assert.equal(formatResultBonusPoints(1),'1 punto'); assert.equal(formatResultBonusPoints(2.5),'2,5 punti');
});
test('legacy daily notifications display points without modifying unrelated messages',()=>{
 const old={type:'PREMIO_RISULTATO',title:'Il tuo guadagno della giornata',message:'Il 01/10/2026 hai guadagnato 5,00 €.'};
 const changed=resultBonusNotificationText(old);assert.equal(changed.message,'Il 01/10/2026 hai ottenuto 5 punti.');assert.equal(resultBonusNotificationText(changed).message,changed.message);
 assert.deepEqual(resultBonusNotificationText({...old,type:'COMUNICAZIONE'}),{...old,type:'COMUNICAZIONE'});
});
