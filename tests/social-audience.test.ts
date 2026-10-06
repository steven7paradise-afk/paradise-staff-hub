import assert from "node:assert/strict";
import test from "node:test";
import { canManageSocialGoals, followerCount, validSocialGoal } from "../lib/social-audience";
test("only administrative roles manage social goals",()=>{
  for(const role of ["ADMIN","SUPER_ADMIN","ZERO"]) assert.equal(canManageSocialGoals(role),true);
  for(const role of ["RESPONSABILE","STAFF","SOCIAL",""]) assert.equal(canManageSocialGoals(role),false);
});
test("goals accept positive integers or explicit removal",()=>{
  for(const value of [null,1,50000]) assert.equal(validSocialGoal(value),true);
  for(const value of [0,-1,1.5,"5000",undefined,NaN,Infinity,10000000001]) assert.equal(validSocialGoal(value),false);
});
test("missing or malformed API counts are never treated as zero",()=>{
  assert.equal(followerCount(0),0);assert.equal(followerCount(12500),12500);
  for(const value of [null,undefined,"100",-1,NaN,1.5]) assert.throws(()=>followerCount(value));
});

import { parseApifyFollowers } from "../lib/social-apify";
test("Apify accepts only the intended account and real numeric counts",()=>{
 assert.equal(parseApifyFollowers("INSTAGRAM",[{username:"paradisebeauty.it",followersCount:123}]),123);
 assert.equal(parseApifyFollowers("FACEBOOK",[{pageName:"paradisebeauty.it",followers:0}]),0);
 assert.equal(parseApifyFollowers("TIKTOK",[{authorMeta:{name:"paradisebeauty.it",fans:456}}]),456);
 assert.throws(()=>parseApifyFollowers("INSTAGRAM",[{username:"another",followersCount:999}]));
 assert.throws(()=>parseApifyFollowers("FACEBOOK",[{pageName:"paradisebeauty.it",likes:123}]));
 assert.throws(()=>parseApifyFollowers("TIKTOK",[]));
});
