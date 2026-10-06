import test from 'node:test';
import assert from 'node:assert/strict';
import {dailyPerformedServices} from '../lib/daily-personal-goal';
const today = new Date('2026-10-06T12:00:00Z');
const worker = {id:'m',name:'Melissa Jaku'};
const card = (id:string, extra:Record<string,unknown>={}) => ({id,created_at:today,answers:{booking_id:id,client_control_correctness:'Controllato',worker_service_sections:[{staffId:'m',services:['Piega','Colore']},{staffId:'m',services:['Piega']},{staffId:'other',services:['Taglio']}],...extra}});
test('conta solo servizi propri completati oggi e deduplica per appuntamento',()=>{
 const rows=dailyPerformedServices([card('1'),card('1'),card('2',{client_control_is_draft:true}),card('3',{client_control_completed_at:'2026-10-05T10:00:00Z'})],worker,[worker.name],today);
 assert.deepEqual(rows,[{service:'Colore',count:1},{service:'Piega',count:1}]);
});
test('non assegna servizi delle schede legacy condivise',()=>{
 const rows=dailyPerformedServices([card('1',{worker_service_sections:[],client_control_service_staff:['Melissa Jaku','Aurora Dassisti'],custom_services:['Taglio']})],worker,[worker.name,'Aurora Dassisti'],today);
 assert.deepEqual(rows,[]);
});
