import {test} from 'node:test';
import assert from 'node:assert/strict';
import {previewShiftResponsible} from '../lib/shift-responsible-preview';
const head={name:'Laura',vice:false,category:'Lavoro',start:'10:00',end:'19:00'};
const deputy={...head,name:'Aurora',vice:true};
test('future work previews manager before clock-in',()=>assert.equal(previewShiftResponsible('2026-10-08',[head,deputy]).name,'Laura'));
test('rest previews deputy',()=>assert.equal(previewShiftResponsible('2026-10-08',[{...head,category:'Riposo'},deputy]).name,'Aurora'));
test('training remains explicitly unresolved',()=>assert.equal(previewShiftResponsible('2026-10-09',[{...head,category:'Formazione'},deputy]).name,null));
