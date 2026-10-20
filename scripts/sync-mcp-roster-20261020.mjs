// One-time, user-approved department corrections. Future syncing is automatic.
// Run without --apply to preview; requires the normal DATABASE_URL environment.
import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();
const assignments = [
 ['Leydi Chero','ecom','Responsabile e-commerce'],['Miguel Chanta Cruces','ecom'],['Steven Alvarez','ecom'],['Clara Tosello','ecom'],['Veronica Del Pozzo','ecom'],
 ['Walter Sullcahuaman','mkt','Responsabile Marketing e Social'],['Oriana Godoy','mkt'],['Diana Jhazmin Oliveros Huanca','mkt'],['Ferdinando Domenico Grasso','mkt','Videomaker'],
 ['Isabella Luiza Brosban','admin'],['Brayan Sullcahuaman Nunez','ceo'],['Franci','tit'],
 ['Biy Darwin Ramirez Castillo','mag'],['Jose Antonio Roman Salazar','mag'],['Jessica Inturri','sarta'],['Rocchina Rosaria De Bellis','sarta'],
];
try {
 const people=await db.user.findMany({where:{active:true,employee_status:{not:'Ex dipendente'}},select:{id:true,name:true,mansione:true,department_key:true,mcp_excluded:true,location:{select:{name:true}}}});
 const changes=[];
 for(const [name,department_key,mansione] of assignments){
  const matches=people.filter(p=>p.name===name);if(matches.length!==1)throw Error(`Expected exactly one active employee: ${name}`);
  changes.push({id:matches[0].id,name,department_key,...(mansione?{mansione}:{})});
 }
 for(const p of people.filter(p=>!changes.some(c=>c.id===p.id))){
  if(p.location?.name.startsWith('Salone ') || /parrucchier|responsabile salone/i.test(p.mansione||''))changes.push({id:p.id,name:p.name,department_key:'saloni'});
  else if(p.name==='Paradise Super Admin'&&p.mansione==='admin')changes.push({id:p.id,name:p.name,department_key:'admin'});
  else if(!p.department_key)throw Error(`Department requires clarification: ${p.name}`);
 }
 console.log(JSON.stringify({apply:process.argv.includes('--apply'),changes},null,2));
 if(process.argv.includes('--apply'))await db.$transaction(async tx=>{
  for(const {id,name,...data} of changes)await tx.user.update({where:{id},data:{...data,...(name==='Ferdinando Domenico Grasso'?{mcp_excluded:false}:{})}});
  const saved=await tx.setting.findUnique({where:{key:'mcp_office_config_v1'}});
  const config=saved?.value||{employees:[],departments:[],task_texts:[]};
  const roster=await tx.user.findMany({where:{active:true,employee_status:{not:'Ex dipendente'},mcp_excluded:false},select:{id:true,department_key:true,mansione:true}});
  config.employees=roster.filter(u=>u.department_key).map(u=>({employee_id:u.id,department_key:u.department_key,public_role:u.mansione||''}));
  for(const [key,name] of [['ecom','Leydi Chero'],['mkt','Walter Sullcahuaman']]){
   const lead=changes.find(c=>c.name===name).id;const existing=config.departments.find(d=>d.key===key);
   if(existing)existing.lead_employee_id=lead;else config.departments.push({key,lead_employee_id:lead,capacity:null});
  }
  for(const d of config.departments)if(!config.employees.some(e=>e.employee_id===d.lead_employee_id&&e.department_key===d.key))d.lead_employee_id=null;
  await tx.setting.upsert({where:{key:'mcp_office_config_v1'},create:{key:'mcp_office_config_v1',value:config},update:{value:config}});
 },{timeout:30000});
}finally{await db.$disconnect();}
