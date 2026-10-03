// lib/cvWordingPosts.js — what each post on a training project does, as the
// firm describes it. Each list is the full set; `core` marks the activities
// that define the post. Variations take the core plus a few routine ones, so no
// CV carries the whole list and no two firms submit the same wording.
//
// `names` are the titles the post goes by in notices; any of them matches.

const POSTS = [
  {
    post: 'Database Officer', names: ['Database Officer', 'MIS Officer', 'Database and MIS Officer', 'Data Officer'],
    strength: 'project databases, MIS, data quality and donor reporting',
    core: [0, 3, 4, 6],
    items: [
      'Managed overall database systems and architecture, including data models, relational structures, and MIS platforms to support project planning, implementation, and monitoring.',
      'Coordinated with field teams, project staff, and donor database officers to gather field-level data, verify trainee selection by district and trade, and generate training event codes.',
      'Managed end-to-end trainee enrollment documentation, including application forms, attendance logs, and targeted support group records across project templates (such as TP 01 to TP 11).',
      'Ensured data hygiene, entry accuracy, coding, and validation across donor-funded project databases such as EVENT/EVENT-II, ENSSURE, and SAMRIDDHI.',
      'Processed and updated skill testing records according to National Skill Testing Board (NSTB) database requirements, and facilitated certificate collection and distribution.',
      'Entered and tracked post-training placement, life skills data, and employment/income verification figures in the MIS.',
      'Conducted advanced data analysis using SQL, Excel, and statistical tools to build real-time dashboards and generate quarterly, semi-annual, and donor-specific progress reports.',
      'Cross-verified trainee enrollment and attendance figures against field monitoring reports, resolving data discrepancies and reporting findings to senior database experts.',
      'Supported the compilation of project proposals, payment claim verifications, field success stories, and audit/evaluation documentation.',
      'Enforced data security, periodic backup/recovery protocols, strict data confidentiality, and compliance with data protection policies.',
      'Conducted capacity building and training sessions for staff on data quality assurance, database management, and reporting systems.',
    ],
  },
  {
    post: 'Monitoring Officer', names: ['Monitoring Officer', 'M&E Officer', 'Monitoring and Evaluation Officer'],
    strength: 'monitoring and evaluation of skill-training projects, field verification and progress reporting',
    core: [0, 4, 5, 6, 11],
    items: [
      'Designed and operationalized monitoring and evaluation (M&E) frameworks, Key Performance Indicators (KPIs), and tracking metrics aligned with donor and project objectives.',
      'Developed and standardized M&E data collection tools, reporting templates, and methodologies for field teams and training staff.',
      'Assessed and selected training venues, verifying the required setup, tools, equipment, and learning materials prior to session commencement.',
      'Supported trainee intake operations, including application collection, document verification, applicant interviews, and final candidate shortlisting.',
      'Conducted routine field inspection visits across project districts to monitor curriculum delivery, classroom sessions, and practical workshops.',
      'Gathered qualitative and quantitative field data through surveys, Key Informant Interviews (KIIs), Focus Group Discussions (FGDs), and direct trainee feedback.',
      'Verified and validated field documents, daily attendance logs, and trainee records to ensure accuracy before database entry.',
      'Coordinated the preparation, verification, and submission of trainee files and registration forms for National Skill Testing Board (NSTB) skill assessments.',
      'Facilitated post-training employment tracking, graduate tracer studies, external monitoring visits, and on-site income verification.',
      'Coordinated with local government bodies, project staff, industry employers, and business associations to secure graduate job placements.',
      'Managed and coordinated baseline, midline, and endline evaluation studies to assess project outcomes, effectiveness, and community impact.',
      'Prepared comprehensive monthly, quarterly, and thematic M&E progress reports, evaluation summaries, and donor deliverables.',
      'Documented project success stories, case studies, emerging field challenges, and lessons learned to inform ongoing program improvements.',
      'Facilitated review workshops and management-level meetings to present evaluative findings, highlight field issues, and recommend corrective actions.',
      'Provided capacity-building training and ongoing technical support to project and field personnel on M&E tools, data quality, and compliance standards.',
    ],
  },
  {
    post: 'Monitoring and Placement Officer', names: ['Monitoring and Placement Officer', 'M&E and Placement Officer', 'Placement and Monitoring Officer'],
    strength: 'graduate placement, employer linkages, tracer studies and M&E',
    core: [0, 1, 6, 8, 11],
    items: [
      'Established and maintained active linkages with employers, manufacturing industries, commercial factories, and business associations to secure employment opportunities for graduates.',
      'Conducted post-training tracer studies, graduate follow-ups, and field-level income verifications to track employment retention and earnings.',
      'Designed and executed comprehensive monitoring and evaluation (M&E) frameworks, key performance indicators (KPIs), and target metrics for training quality and graduate job placements.',
      'Developed, standardized, and distributed M&E data collection instruments, trainee intake forms, and regular reporting templates.',
      'Conducted participant intake assessments, applicant screening interviews, and final shortlisting in coordination with local government bodies and project teams.',
      'Inspected and finalized training venues, ensuring workshop spaces were fully equipped with standard tools, machineries, and raw materials before training began.',
      'Carried out regular on-site monitoring visits to training centers to observe classroom instruction, practical delivery, and trainee attendance.',
      'Gathered qualitative and quantitative feedback through focus group discussions (FGDs), key informant interviews (KIIs), and trainee surveys to address delivery bottlenecks.',
      'Verified, audited, and compiled primary field records, trainee logbooks, and registration dossiers for National Skill Testing Board (NSTB) skill assessments.',
      'Coordinated baseline, midline, and endline evaluation studies to assess training outcomes, workforce integration, and overall project effectiveness.',
      'Facilitated visits and audits by external monitoring delegations, donor representatives, and government stakeholders.',
      'Compiled monthly, quarterly, and phase-wise progress reports, placement updates, and donor-required evaluation summaries.',
      'Documented success stories, case studies of employed graduates, lessons learned, and systemic recommendations for program improvement.',
      'Organized stakeholder review workshops and attended management-level meetings to communicate ground realities, placement barriers, and corrective measures.',
      'Provided continuous capacity-building support and technical guidance to field personnel and instructional staff on M&E tools and data compliance.',
    ],
  },
  {
    post: 'Training Coordinator', names: ['Training Coordinator', 'Training Manager', 'Project Coordinator'],
    strength: 'planning and managing vocational training programmes, trainer supervision and client reporting',
    core: [0, 1, 4, 6, 7],
    items: [
      'Provided overall leadership, planning, and management for vocational training programs and instructional teams in line with project agreements and client requirements.',
      'Prepared, updated, and executed Training Implementation Plans (TIP) to ensure the structured and timely rollout of all training activities.',
      'Led social marketing, outreach campaigns, applicant screening, and candidate selection in close coordination with local government authorities, Business Industry Associations (BIAs), and consortium enterprises.',
      'Coordinated actively with project management offices, donor representatives, and key stakeholders to align delivery with contract milestones.',
      'Conducted regular on-site monitoring and supervisory visits across training venues to ensure quality control, adherence to curricula, and workplace safety compliance.',
      'Managed, mentored, and briefed trainers and training support staff on project norms, lesson delivery techniques, and mandatory administrative procedures.',
      'Liaised with CTEVT, the National Skill Testing Board (NSTB), and testing centers to organize logistics, documentation, and skill assessment certification for trainees.',
      'Partnered with industries, employer associations, factories, and commercial enterprises to secure on-the-job training (OJT) and job placements for graduates.',
      'Prepared and submitted contractual documentation, including inception reports, training commencement notices, periodic progress reports, and training completion reports.',
      'Verified, compiled, and processed milestone payment claim files and related administrative documentation per donor and client guidelines.',
      'Handled day-to-day administrative problem-solving, field feedback, and trainee grievance redressal to maintain smooth classroom and workshop operations.',
    ],
  },
  {
    post: 'Admin Officer', names: ['Admin Officer', 'Administrative Officer', 'Administration Officer'],
    strength: 'office administration, procurement, logistics and HR administration',
    core: [0, 1, 2, 3],
    items: [
      'Managed overall office administration, day-to-day operations, official correspondence, and general front-desk logistics.',
      'Coordinated procurement processes for office supplies, training consumables, equipment, and workshop materials in adherence to organizational guidelines.',
      'Maintained inventory and asset registers, conducted periodic physical verifications, and arranged maintenance for office equipment and facilities.',
      'Handled personnel and HR administration, including staff attendance, leave tracking, employment contracts, and personnel documentation.',
      'Oversaw fleet management, travel arrangements, vehicle scheduling, and field mission logistics for project personnel and visiting monitors.',
      'Managed organizational filing systems, official documentation, record archiving, and dispatching of administrative correspondence.',
      'Supervised administrative support staff, including drivers, office assistants, and security personnel, ensuring efficient daily workflows.',
      'Facilitated logistics for project events, stakeholder meetings, orientations, and internal review sessions.',
    ],
  },
  {
    post: 'Finance Officer', names: ['Finance Officer', 'Accountant', 'Account Officer', 'Accounts Officer'],
    strength: 'project accounting, payment claims, financial reporting and audit support',
    core: [0, 1, 3, 5],
    items: [
      'Maintained general ledgers, books of accounts, and financial record-keeping in compliance with accounting standards and statutory regulations.',
      'Processed and verified all project payment claims, vendor invoices, travel expense reports, and petty cash disbursements.',
      'Managed bank operations, including account reconciliations, cash flow tracking, fund transfers, and petty cash management.',
      'Prepared monthly, quarterly, and annual financial statements, expenditure reports, and project budget tracking sheets.',
      'Handled payroll administration, including tax deductions at source (TDS), salary disbursements, and social security remittances.',
      'Ensured strict adherence to internal financial controls, donor financial guidelines, and tax compliances.',
      'Supported external, internal, and statutory audit processes by preparing audit schedules, financial vouchers, and necessary financial documentation.',
      'Monitored budget allocations against expenditures, identifying budget variances and assisting in budget forecasting.',
    ],
  },
  {
    post: 'Admin and Finance Officer', names: ['Admin and Finance Officer', 'Administration and Finance Officer', 'Admin/Finance Officer', 'Finance and Admin Officer'],
    strength: 'combined finance, procurement, HR and administrative management',
    core: [0, 1, 2, 4, 9],
    items: [
      'Managed dual operational portfolios encompassing financial accounting, internal controls, human resources, and general administrative services.',
      'Processed daily financial transactions, accounts payable, vendor billing, and project advance settlements while maintaining up-to-date ledgers.',
      'Managed procurement procedures, vendor contracting, quotations comparison, and competitive bidding in line with donor procurement standards.',
      'Maintained comprehensive inventory registers for institutional assets, training machinery, office supplies, and project deliverables.',
      'Prepared monthly bank reconciliations, fund balance statements, and periodic financial expenditure reports for management and donors.',
      'Executed payroll calculations, statutory tax filings (TDS), and timely remittances in accordance with local labor and tax laws.',
      'Coordinated travel itineraries, vehicle usage, field logistics, venue reservations, and workshop supplies for training operations.',
      'Managed employee records, leave administration, contract renewals, and daily attendance logs across head and field offices.',
      'Led documentation prep for internal, donor, and statutory audits, ensuring complete voucher verification, supporting receipts, and full compliance.',
      'Monitored monthly budget utilization against approved work plans, reporting burn rates and expenditure forecasts to project managers.',
    ],
  },
  {
    post: 'Placement and Counselling Officer', names: ['Placement and Counselling Officer', 'Placement and Counseling Officer', 'Placement Officer', 'Career Counsellor'],
    strength: 'career counselling, market linkages, enterprise support and graduate placement',
    core: [1, 4, 7, 10],
    items: [
      'Monitored and supervised ongoing business skill development and vocational training sessions to ensure delivery standards.',
      'Provided career counseling, individual guidance, and coaching to trainees to identify viable wage-employment and self-employment pathways.',
      'Organized micro-enterprise development training and capacity-building workshops in close consultation with local line agencies and community stakeholders.',
      'Assisted in developing training manuals, instructional materials, and learning modules for diverse training and entrepreneurship courses.',
      'Evaluated local business opportunities and conducted sub-sector analyses to align training and placement efforts with market demand.',
      'Facilitated Business Development Service (BDS) providers to design and deliver targeted enterprise support services to farmers, graduates, and local entrepreneurs.',
      'Supported the creation of local livelihood and placement opportunities for poor, disadvantaged, and marginalized target groups.',
      'Established and strengthened market chain linkages, industry networks, and access to essential business services and production inputs.',
      'Guided trainees, smallholders, local resource persons, and service providers in preparing viable business plans, financial projections, and enterprise models.',
      'Provided continuous post-training coaching, mentoring, and technical backstopping to support enterprise development and sustainable market system integration.',
      'Coordinated with employers, enterprise associations, and local industries to track graduate job placements, self-employment startups, and income generation outcomes.',
    ],
  },
  {
    post: 'Entrepreneurship Development Trainer', names: ['Entrepreneurship Development Trainer', 'EDT', 'Entrepreneurship Trainer', 'MED Trainer'],
    strength: 'micro-enterprise development training, business planning and post-training business counselling',
    trainer: true,
    core: [0, 1, 3, 4, 6],
    items: [
      'Planned and conducted Micro-Enterprise Development (MED) and entrepreneurship skill development sessions based on standard TVET/project curricula.',
      'Delivered theoretical and practical modules on entrepreneurial competency, business idea generation, and opportunity assessment.',
      'Guided trainees step-by-step in conducting rapid market assessments, competitor analysis, and demand forecasting.',
      'Assisted participants and aspiring entrepreneurs in preparing viable, bankable business plans, cost-benefit analyses, and cash flow projections.',
      'Taught foundational business management skills, including pricing strategies, bookkeeping, inventory management, and marketing channels.',
      'Provided technical coaching on access to finance, connecting trainees with microfinance institutions (MFIs), cooperatives, and government subsidized-loan schemes.',
      'Conducted post-training business counseling and on-site technical backstopping to support enterprise registration, legal compliance, and launch.',
      'Maintained daily session logbooks, trainee attendance sheets, and baseline skill assessment records.',
      'Assessed learner performance continuously and provided targeted mentoring to marginalized and disadvantaged participants.',
      'Tracked new micro-enterprise start-ups, business survival rates, and initial revenue generation to prepare training completion and impact reports.',
    ],
  },
  {
    post: 'District Coordinator', names: ['District Coordinator', 'District Project Coordinator', 'Field Coordinator'],
    strength: 'district-level implementation, local government coordination and training supervision',
    core: [0, 1, 4, 5, 10],
    items: [
      'Led overall project implementation, operational planning, and administrative management at the district level.',
      'Coordinated with local government authorities (palikas/municipalities), line agencies, and community leaders to ensure project alignment and local ownership.',
      'Supervised district-level beneficiary mobilization, social marketing, and candidate selection across targeted occupational trades.',
      'Managed and monitored training venues, ensuring trainers had required machinery, tools, raw materials, and safety equipment in place.',
      'Conducted regular supervisory visits to field training sites to inspect training quality, curriculum adherence, and trainer/trainee attendance.',
      'Liaised with district business associations, chamber of commerce chapters, and local industries to facilitate On-the-Job Training (OJT) and graduate placements.',
      'Coordinated with the National Skill Testing Board (NSTB) and evaluation teams to schedule, organize, and administer competency assessments.',
      'Supported the monitoring and database teams in collecting, verifying, and validating primary field data and income verification records.',
      'Facilitated field missions for donor delegates, central management teams, and third-party monitoring evaluators.',
      'Resolved operational bottlenecks, vendor delivery issues, and field-level grievances in coordination with the central project management unit.',
      'Prepared and submitted consolidated monthly district progress reports, event completion summaries, and administrative expense claims.',
    ],
  },
];

// Past tense on the CV's record of a job; present tense for the tasks a bid assigns.
const BASE = {
  Managed: 'Manage', Coordinated: 'Coordinate', Ensured: 'Ensure', Processed: 'Process', Entered: 'Enter',
  Conducted: 'Conduct', 'Cross-verified': 'Cross-verify', Supported: 'Support', Enforced: 'Enforce',
  Designed: 'Design', Developed: 'Develop', Assessed: 'Assess', Gathered: 'Gather', Verified: 'Verify',
  Facilitated: 'Facilitate', Prepared: 'Prepare', Documented: 'Document', Provided: 'Provide',
  Established: 'Establish', Carried: 'Carry', Inspected: 'Inspect', Compiled: 'Compile', Organized: 'Organize',
  Led: 'Lead', Liaised: 'Liaise', Partnered: 'Partner', Handled: 'Handle', Maintained: 'Maintain',
  Oversaw: 'Oversee', Supervised: 'Supervise', Executed: 'Execute', Monitored: 'Monitor', Evaluated: 'Evaluate',
  Assisted: 'Assist', Guided: 'Guide', Taught: 'Teach', Delivered: 'Deliver', Planned: 'Plan', Tracked: 'Track',
  Resolved: 'Resolve',
};
// The rest of a leading verb chain: "Developed, standardized, and distributed …".
const MORE = {
  operationalized: 'operationalize', validated: 'validate', standardized: 'standardize', distributed: 'distribute',
  executed: 'execute', audited: 'audit', compiled: 'compile', finalized: 'finalize', updated: 'update',
  attended: 'attend', mentored: 'mentor', briefed: 'brief', strengthened: 'strengthen', maintained: 'maintain',
  coordinated: 'coordinate', managed: 'manage', submitted: 'submit', processed: 'process', supervised: 'supervise',
  verified: 'verify', prepared: 'prepare', developed: 'develop', tracked: 'track', monitored: 'monitor',
  selected: 'select', conducted: 'conduct', organized: 'organize', documented: 'document',
};
/** "Developed, standardized, and distributed M&E tools" → "Develop, standardize, and distribute M&E tools". */
const toDuty = (line) => {
  const words = line.split(' ');
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const bare = w.replace(/,$/, '');
    const comma = w.endsWith(',') ? ',' : '';
    if (i === 0) { const b = BASE[bare]; if (!b) break; words[i] = b + comma; continue; }
    if (bare === 'and') continue;
    const b = MORE[bare.toLowerCase()];
    if (!b) break;
    words[i] = b + comma;
  }
  return words.join(' ');
};

const LETTERS = 'ABCDEFG';
/** Activities: core + a rotating pair of routine ones; tasks: the core as duties. */
function variationsFor(p) {
  const routine = p.items.map((_, i) => i).filter(i => !p.core.includes(i));
  const pickRoutine = (k, n) => Array.from({ length: Math.min(n, routine.length) }, (_, j) => routine[(k + j) % routine.length]);
  const lines = (idx) => [...new Set(idx)].sort((a, b) => a - b).map(i => `• ${p.items[i]}`).join('\n');
  const out = [];
  for (let k = 0; k < 4; k++) {
    // One core activity is left out in turn, so even the core differs.
    const core = p.core.length > 4 ? p.core.filter((_, j) => j !== k % p.core.length) : p.core;
    out.push({ field: 'activities', label: `${p.post} — activities ${LETTERS[k]}`, body: lines([...core, ...pickRoutine(k, 2)]) });
  }
  for (let k = 0; k < 2; k++) {
    const idx = [...p.core, ...pickRoutine(k + 2, 1)];
    out.push({ field: 'detailed_tasks', label: `${p.post} — tasks ${LETTERS[k]}`,
      body: [...new Set(idx)].sort((a, b) => a - b).map(i => `• ${toDuty(p.items[i])}`).join('\n') });
  }
  out.push({ field: 'adequacy', label: `${p.post} — prior work A`, body: [
    `• ${p.post} on skill-training projects for {clients}, over {years} years.`,
    p.trainer ? '• Conducted {events} training events.' : '• Supported {events} training events.',
    `• Experienced in ${p.strength}.`].join('\n') });
  return out.map(v => ({ ...v, position: p.names.join(' | ') }));
}

const POST_SEED = POSTS.flatMap(variationsFor);

module.exports = { POSTS, POST_SEED, toDuty, BASE };
