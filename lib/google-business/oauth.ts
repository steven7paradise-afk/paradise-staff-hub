import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { issuer } from '@/lib/mcp/security';
export const GBP_IDENTITY_SCOPE = 'openid email';
export const GBP_SCOPE = 'https://www.googleapis.com/auth/business.manage';
export const callbackUrl = () => `${issuer()}/api/google-business/callback`;
export function configuration() {
  const id=process.env.GBP_CLIENT_ID, secret=process.env.GBP_CLIENT_SECRET;
  const email=(process.env.GBP_ACCOUNT_EMAIL || '').trim().toLowerCase();
  const key=Buffer.from(process.env.GBP_TOKEN_ENCRYPTION_KEY || '', 'base64');
  if(!id || !secret || key.length!==32 || !email.includes('@') || /@(gmail|googlemail)\.com$/.test(email)) throw new Error('Configura GBP_CLIENT_ID, GBP_CLIENT_SECRET, GBP_ACCOUNT_EMAIL e GBP_TOKEN_ENCRYPTION_KEY sul server.');
  return {id,secret,key,email};
}
export function seal(value:unknown) {
  const iv=randomBytes(12), cipher=createCipheriv('aes-256-gcm',configuration().key,iv);
  const encrypted=Buffer.concat([cipher.update(JSON.stringify(value),'utf8'),cipher.final()]);
  return [iv,cipher.getAuthTag(),encrypted].map(b=>b.toString('base64')).join('.');
}
export function unseal(value:string): {refresh_token:string} {
  const [iv,tag,data]=value.split('.').map(v=>Buffer.from(v,'base64'));
  const decipher=createDecipheriv('aes-256-gcm',configuration().key,iv);decipher.setAuthTag(tag);
  return JSON.parse(Buffer.concat([decipher.update(data),decipher.final()]).toString('utf8'));
}
export async function tokenRequest(fields:Record<string,string>) {
  const {id,secret}=configuration();
  const response=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({...fields,client_id:id,client_secret:secret}),signal:AbortSignal.timeout(20000),cache:'no-store'});
  if(!response.ok) throw new Error('Autorizzazione Google non valida o revocata. Ricollega l’account aziendale.');
  return response.json() as Promise<{access_token:string;refresh_token?:string;scope?:string}>;
}
export async function accessToken() {
  const connection=await prisma.googleBusinessConnection.findUnique({where:{id:'primary'}});
  if(!connection) throw new Error('Collega prima l’account Google aziendale.');
  return (await tokenRequest({grant_type:'refresh_token',refresh_token:unseal(connection.tokens_encrypted).refresh_token})).access_token;
}
export async function googleGet(url:string,token:string) {
  const response=await fetch(url,{headers:{Authorization:`Bearer ${token}`},cache:'no-store',signal:AbortSignal.timeout(20000)});
  if(!response.ok) throw new Error(response.status===403 ? 'Google ha negato l’accesso: controlla approvazione API, API abilitate e permessi sulla scheda.' : `Google Business Profile non disponibile (HTTP ${response.status}).`);
  return response.json();
}
export async function availableLocations() {
  const token=await accessToken();const result:{name:string;title:string;address:string}[]=[];
  let accountPage='';
  do {
    const accounts=await googleGet(`https://mybusinessaccountmanagement.googleapis.com/v1/accounts?pageSize=20&pageToken=${encodeURIComponent(accountPage)}`,token);
    for(const account of accounts.accounts || []) {
      if(!/^accounts\/\d+$/.test(account.name))continue;
      let page='';
      do {
        const data=await googleGet(`https://mybusinessbusinessinformation.googleapis.com/v1/${account.name}/locations?readMask=name,title,storefrontAddress&pageSize=100&pageToken=${encodeURIComponent(page)}`,token);
        for(const location of data.locations || []) {
          if(!/^locations\/\d+$/.test(location.name))continue;
          result.push({name:`${account.name}/${location.name}`,title:location.title || '',address:[...(location.storefrontAddress?.addressLines||[]),location.storefrontAddress?.locality].filter(Boolean).join(', ')});
        }
        page=data.nextPageToken || '';
      }while(page);
    }
    accountPage=accounts.nextPageToken || '';
  }while(accountPage);
  return result;
}

export async function verifyBusinessAccount(token:string) {
  const expected=configuration().email;
  const response=await fetch('https://openidconnect.googleapis.com/v1/userinfo',{headers:{Authorization:`Bearer ${token}`},cache:'no-store',signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw new Error('Impossibile verificare l’account aziendale.');
  const identity=await response.json();
  if(identity.email_verified!==true || typeof identity.email!=='string' || identity.email.toLowerCase()!==expected)throw new Error('Usa esclusivamente l’account Google aziendale configurato.');
}
