import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validSupplyNotes,supplyAmounts} from '../lib/shift-products';
const row={productId:'one',name:'Prodotto',quantity:'5',note:''};
test('bring only available units and identify remainder',()=>{assert.deepEqual(supplyAmounts(5,3),{bring:3,missing:2});assert.deepEqual(supplyAmounts(2,10),{bring:2,missing:0});});
test('free text is allowed without inventing a catalog ID',()=>{assert.ok(validSupplyNotes({needed:true,rows:[{...row,productId:''}]},new Set()));assert.equal(validSupplyNotes({needed:true,rows:[row]},new Set()),false);});
test('require positive whole quantities and no duplicates',()=>{for(const rows of [[{...row,quantity:'0'}],[{...row,quantity:'1.5'}],[row,row]])assert.equal(validSupplyNotes({needed:true,rows},new Set(['one'])),false);});
test('all fine is valid with an empty list',()=>assert.ok(validSupplyNotes({needed:false,rows:[]},new Set())));
