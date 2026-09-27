const { signToken } = require('./middleware/auth');
const { pool } = require('./db/pool');
const API='http://localhost:4123/api';
const call=async(m,p,tok,body)=>{const h={Authorization:'Bearer '+tok};if(body)h['Content-Type']='application/json';
  const r=await fetch(API+p,{method:m,headers:h,body:body?JSON.stringify(body):undefined});
  const t=await r.text();try{return{status:r.status,body:JSON.parse(t)}}catch{return{status:r.status,body:t.slice(0,180)}}};
(async()=>{
  const {rows:[sa]}=await pool.query("SELECT id,email,role FROM users WHERE role='superadmin'");
  const SA=signToken(sa);
  const mk=async(n,a,c)=>(await call('POST','/institutes',SA,{name:n,acronym:a,status:'Active',reg_no:a,pan:a,contact_person:c})).body;
  const W=await mk('Western Lalitpur TTI','WLTTI','Dipesh Pyakurel');
  const U=await mk('Universal TTE','UTTE','Bina Shrestha');
  const C=await mk('CHRA Training','CHRA','Ram Thapa');
  const I=await mk('IC Institute','IC','Sita Rai');
  const occ=(await pool.query("INSERT INTO occupations (name,sector,level,is_custom,is_active) VALUES ('Assistant Tailor','Tailoring, Garment, Textile and Hosiery','Level 1',TRUE,TRUE) RETURNING id")).rows[0];
  const p1=(await call('POST','/hr/people',SA,{full_name:'Amruta Devi',person_type:'Trainer'})).body;
  const p2=(await call('POST','/hr/people',SA,{full_name:'Ramesh Adhikari',person_type:'Trainer'})).body;

  console.log('1 — create the notice');
  const t=(await call('POST','/tenders',SA,{title:'Assistant Tailor training',
    reference_no:'BNP-2082/083-CS-VST-1.7', client_name_manual:'Budhanilkantha Municipality Office',
    fy:'2082/83', stage:'EOI', occupation_ids:[occ.id]})).body;

  console.log('2 — three bidders: two solo, one JV');
  await call('PUT',`/tenders/${t.id}`,SA,{title:t.title, bidders:[
    {firms:[{institute_id:W.id}]},
    {firms:[{institute_id:U.id}]},
    {firms:[{institute_id:C.id,role:'Lead'},{institute_id:I.id,role:'JV Member'}]},
  ]});
  let d=(await call('GET',`/tenders/${t.id}`,SA)).body;
  console.log('  ', d.bidders.map(b=>`${b.display_name} [${b.status}]`));

  console.log('\n3 — each bidder proposes its own team');
  await call('PUT',`/tenders/${t.id}`,SA,{title:t.title, people_bidder_id:d.bidders[0].id,
    people:[{person_id:p1.id, occupation_id:occ.id, proposed_position:'Main Trainer'}]});
  await call('PUT',`/tenders/${t.id}`,SA,{title:t.title, people_bidder_id:d.bidders[2].id,
    people:[{person_id:p2.id, occupation_id:occ.id, proposed_position:'Team Leader'}]});
  d=(await call('GET',`/tenders/${t.id}`,SA)).body;
  for (const b of d.bidders)
    console.log(`   ${b.display_name}: ${d.people.filter(p=>p.bidder_id===b.id).map(p=>p.full_name).join(', ')||'(nobody)'}`);

  console.log('\n4 — EOI documents, per bidder');
  for (const b of d.bidders.filter(x=>d.people.some(p=>p.bidder_id===x.id))) {
    const pack=(await call('GET',`/tenders/${t.id}/cv?bidder_id=${b.id}`,SA)).body;
    console.log(`   ${b.display_name}: Name of Consultant = "${pack.tender.institute_name}", CVs = ${pack.cvs.length}`);
  }
  console.log('   without a bidder ->', (await call('GET',`/tenders/${t.id}/cv`,SA)).status, '(want 400)');

  console.log('\n5 — mark one bidder shortlisted, then go to RFP');
  await call('PUT',`/tenders/${t.id}`,SA,{title:t.title, bidders:d.bidders.map(b=>({
    id:b.id, label:b.label, status: b.display_name.startsWith('CHRA') ? 'Shortlisted' : 'Not shortlisted',
    firms:b.firms}))});
  d=(await call('GET',`/tenders/${t.id}`,SA)).body;
  console.log('  EOI outcomes:', d.bidders.map(b=>`${b.display_name}=${b.status}`));
  const r=(await call('POST',`/tenders/${t.id}/advance`,SA,{stage:'RFP'})).body;
  const rd=(await call('GET',`/tenders/${r.id}`,SA)).body;
  console.log('  RFP stage carries:', rd.bidders.map(b=>`${b.display_name} [${b.status}]`),
              '| staff:', rd.people.map(p=>p.full_name));
  console.log('  EOI untouched:', (await call('GET',`/tenders/${t.id}`,SA)).body.bidders.map(b=>b.status));
  await pool.end();
})();
