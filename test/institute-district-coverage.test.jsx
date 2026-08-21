/**
 * The consolidated "districts with training experience" list on a firm.
 *
 * Districts were only ever visible one assignment at a time, so answering
 * "have they worked in Banke?" meant opening every assignment in turn.
 *
 * The counting rules are the part worth pinning, because both are easy to get
 * wrong and neither is visible on screen:
 *
 *   - an assignment touching a district through several occupation rows counts
 *     once for that district, not once per row;
 *   - an occupation row delivered across several districts contributes its
 *     trainees to each, because the row carries a single figure for the whole
 *     row and splitting it would invent a breakdown the data does not hold.
 */
import { describe, it, beforeEach, afterEach, expect } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { assertNoConsoleErrors } from './setup.js';
import { clients } from './fixtures.js';
import InstituteDetail from '../src/components/InstituteDetail.jsx';

const occ=(o={})=>({id:'o'+Math.random(), nameInLetter:'Beautician', ctevtOccupationId:1,
  level:'Level 1', duration:'390', trainees:'20', locations:[], ...o});
const asg=(id,occs)=>({id, fy:'2081/82', assignmentName:'A'+id, clientId:1, contractValue:'100',
  startDate:'2082/01/15', endDate:'2082/04/10', occupations:occs, locations:[]});

const institute={
  id:1,name:'Test Firm',acronym:'TF',regNo:'1',type:'Private',status:'Active',address:'',
  contactPerson:'',phone:'',mobile:'',email:'',renewalDue:'',remarks:'',logo:null,website:'',
  latitude:'',longitude:'',nstb:[],taxClearance:[],affiliation:[],infrastructure:[],
  totalTrainees:0,totalStAppeared:0,totalClients:0,totalAffPrograms:0,isShortlistingOnly:false,
  experience:[
    // one assignment touching Kaski twice (two occupation rows) -> 1 assignment
    asg(1,[ occ({trainees:'20',locations:[{district:'Kaski',province:'Gandaki'}]}),
            occ({trainees:'30',locations:[{district:'Kaski',province:'Gandaki'}]}) ]),
    // a second assignment in Kaski -> 2 assignments total for Kaski
    asg(2,[ occ({trainees:'10',locations:[{district:'Kaski',province:'Gandaki'}]}) ]),
    // one occupation delivered across two districts -> trainees count to each
    asg(3,[ occ({trainees:'40',locations:[{district:'Banke',province:'Lumbini'},
                                          {district:'Dang',province:'Lumbini'}]}) ]),
    // blank district must be ignored entirely
    asg(4,[ occ({trainees:'99',locations:[{district:'',province:'Bagmati'}]}) ]),
  ],
};

let container, root;
beforeEach(()=>{ container=document.createElement('div'); document.body.appendChild(container); });
afterEach(async()=>{ await act(async()=>{root?.unmount();}); container.remove(); });
async function mount(){
  await act(async()=>{ root=createRoot(container);
    root.render(<InstituteDetail institute={institute} clients={clients} onUpdateClients={()=>{}}
      onBack={()=>{}} onUpdate={()=>{}} onRefresh={()=>{}} onDelete={()=>{}} token="t"
      isAdmin isEditor={false} isSuperAdmin={false} isShortlistOnly={false}
      onBulkAdd={()=>{}} onAddNSTB={()=>{}}/>); });
  await act(async()=>{ await Promise.resolve(); });
}
const chip=(d)=>[...container.querySelectorAll('span')].find(s=>s.getAttribute('title')?.startsWith(d+' —'));

describe('district coverage', () => {
  it('lists districts grouped by province, ignoring blanks', async () => {
    await mount();
    expect(container.textContent).toContain('Districts with training experience');
    expect(container.textContent).toMatch(/3 districts · 2 provinces/);
    expect(container.textContent).toContain('Gandaki');
    expect(container.textContent).toContain('Lumbini');
    expect(container.textContent).not.toContain('Bagmati'); // blank district dropped
    assertNoConsoleErrors();
  });

  it('counts an assignment once per district even when it touches it twice', async () => {
    await mount();
    // Kaski: assignments 1 and 2 -> 2, trainees 20+30+10 = 60
    expect(chip('Kaski').getAttribute('title')).toBe('Kaski — 2 assignments, 60 trainees');
  });

  it('credits a multi-district occupation row to each district', async () => {
    await mount();
    expect(chip('Banke').getAttribute('title')).toBe('Banke — 1 assignment, 40 trainees');
    expect(chip('Dang').getAttribute('title')).toBe('Dang — 1 assignment, 40 trainees');
  });
});
