import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validHairNotes} from '../lib/shift-hair';
const ids=new Set(['one']);const row={productId:'one',present:'0',order:'500',note:''};
test('no stock shortage needs no rows',()=>{assert.ok(validHairNotes({lowStock:false,rows:[]},ids));assert.equal(validHairNotes({lowStock:false,rows:[row]},ids),false);});
test('zero present and positive grams to order are valid',()=>assert.ok(validHairNotes({lowStock:true,rows:[row]},ids)));
test('unknown products, duplicates and zero orders are rejected',()=>{for(const rows of [[{...row,productId:'fake'}],[row,row],[{...row,order:'0'}],[{...row,present:'-1'}]])assert.equal(validHairNotes({lowStock:true,rows},ids),false);});
test('Italian decimals accepted and incomplete yes rejected',()=>{assert.ok(validHairNotes({lowStock:true,rows:[{...row,present:'12,5'}]},ids));assert.equal(validHairNotes({lowStock:true,rows:[]},ids),false);});
