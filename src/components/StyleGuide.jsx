/**
 * Design-system reference — reachable at #styleguide.
 *
 * Exists so the new visual direction can be judged on real components before it
 * is rolled across 16 screens. Uses sample values only: this page renders no
 * live data and is not linked from navigation.
 */
import { useState } from 'react';
import { Btn } from '../md.jsx';
import {
  PageHeader, KpiCard, InkCard, StatusBadge, PillTabs,
  SegmentedProgress, EmptyState, Skeleton, SkeletonTable,
} from './ui/primitives.jsx';

const Section = ({ title, note, children }) => (
  <section style={{marginBottom:40}}>
    <h2 style={{fontSize:'var(--fs-title)', fontWeight:700, marginBottom:4}}>{title}</h2>
    {note && <p style={{fontSize:'var(--fs-meta)', color:'var(--text3)', marginBottom:14}}>{note}</p>}
    {children}
  </section>
);

const Grid = ({ children, min = 220 }) => (
  <div style={{display:'grid', gap:14, gridTemplateColumns:`repeat(auto-fit, minmax(${min}px, 1fr))`}}>
    {children}
  </div>
);

export default function StyleGuide() {
  const [tab, setTab] = useState('overview');

  return (
    <div style={{maxWidth:1180}}>
      <PageHeader
        title="Design"
        emphasis="System"
        breadcrumb="System / Style guide"
        sub="Every primitive the redesign is built from. Sample values — no live data."
        actions={<Btn className="btn btn-secondary btn-sm">Secondary</Btn>}
      />

      <Section title="Pastel surfaces"
        note="Cards on a pastel fill take no border and no shadow — separation comes from colour alone.">
        <Grid min={150}>
          {['periwinkle','blue','mint','pink','cream','lilac'].map(t => (
            <div key={t} style={{background:`var(--pastel-${t})`, borderRadius:'var(--radius-card)',
              padding:'20px 16px', color:'var(--on-pastel)'}}>
              <div style={{fontWeight:700, fontSize:'var(--fs-body)'}}>{t}</div>
              <div style={{fontSize:'var(--fs-meta)', color:'var(--on-pastel-muted)', marginTop:4}}>
                --pastel-{t}
              </div>
            </div>
          ))}
        </Grid>
      </Section>

      <Section title="KPI cards"
        note="Oversized numeral, small muted unit beside it. One emphasis card per screen carries the primary action.">
        <Grid min={210}>
          <KpiCard label="Institutes" value="24" unit="/ 26" icon="account_balance"
            tone="periwinkle" footer="22 active" />
          <KpiCard label="Assignments" value="318" icon="assignment"
            tone="blue" footer="47 this FY" />
          <KpiCard label="Trainees" value="11,843" icon="groups"
            tone="mint" footer="Across all institutes" />
          <InkCard title="3 renewals due" sub="Within the next 30 days">
            <Btn className="btn btn-sm on-ink">Review</Btn>
          </InkCard>
        </Grid>
      </Section>

      <Section title="Status" note="Semantic tones, never raw colour names.">
        <div style={{display:'flex', gap:10, flexWrap:'wrap'}}>
          <StatusBadge tone="success">Active</StatusBadge>
          <StatusBadge tone="warning">Renewal due</StatusBadge>
          <StatusBadge tone="error">Expired</StatusBadge>
          <StatusBadge tone="info">Draft</StatusBadge>
          <StatusBadge tone="neutral">Not recorded</StatusBadge>
        </div>
      </Section>

      <Section title="Pill tabs" note="Active tab is solid ink; the rest are a pale fill with no border.">
        <PillTabs value={tab} onChange={setTab} tabs={[
          { id:'overview', label:'Overview' },
          { id:'assignments', label:'Assignments', badge:50 },
          { id:'clients', label:'Clients', badge:21 },
          { id:'compliance', label:'Compliance' },
          { id:'documents', label:'Documents' },
        ]}/>
        <div style={{background:'var(--canvas-card)', borderRadius:'var(--radius-card)',
          padding:20, fontSize:'var(--fs-body)', color:'var(--text3)'}}>
          Panel for <strong style={{color:'var(--text)'}}>{tab}</strong>
        </div>
      </Section>

      <Section title="Segmented progress"
        note="Discrete blocks read as “5 of 8” better than a percentage bar — suited to counts, not ratios.">
        <Grid min={240}>
          <div style={{background:'var(--pastel-periwinkle)', borderRadius:'var(--radius-card)', padding:20}}>
            <SegmentedProgress filled={5} total={8} label="5 of 8 documents on file" />
          </div>
          <div style={{background:'var(--pastel-mint)', borderRadius:'var(--radius-card)', padding:20}}>
            <SegmentedProgress filled={7} total={7} tone="var(--success)" label="All compliance items valid" />
          </div>
          <div style={{background:'var(--pastel-pink)', borderRadius:'var(--radius-card)', padding:20}}>
            <SegmentedProgress filled={2} total={6} tone="var(--warning)" label="2 of 6 fiscal years recorded" />
          </div>
        </Grid>
      </Section>

      <Section title="Buttons" note="One primary per view. Danger only for destructive actions.">
        <div style={{display:'flex', gap:10, flexWrap:'wrap', alignItems:'center'}}>
          <Btn className="btn btn-primary">Primary</Btn>
          <Btn className="btn btn-secondary">Secondary</Btn>
          <Btn className="btn btn-ghost">Tertiary</Btn>
          <Btn className="btn btn-danger">Delete</Btn>
          <Btn className="btn btn-primary btn-sm">Small</Btn>
        </div>
      </Section>

      <Section title="Empty state" note="Say what belongs here and offer the action, rather than “No data”.">
        <div style={{background:'var(--canvas-card)', borderRadius:'var(--radius-card)'}}>
          <EmptyState icon="assignment" title="No assignments yet"
            body="Assignments delivered by this institute will appear here."
            action={<Btn className="btn btn-primary btn-sm">Add assignment</Btn>}/>
        </div>
      </Section>

      <Section title="Loading" note="Skeletons hold the page shape instead of a full-screen spinner.">
        <Grid min={210}>
          {['periwinkle','blue','mint'].map(t => (
            <div key={t} style={{background:`var(--pastel-${t})`, borderRadius:'var(--radius-card)', padding:'18px 20px'}}>
              <Skeleton w="45%" h={12}/>
              <Skeleton w="70%" h={30} style={{marginTop:16}}/>
              <Skeleton w="55%" h={10} style={{marginTop:12}}/>
            </div>
          ))}
        </Grid>
        <div style={{background:'var(--canvas-card)', borderRadius:'var(--radius-card)', padding:20, marginTop:14}}>
          <SkeletonTable rows={4} cols={5}/>
        </div>
      </Section>

      <Section title="Type scale" note="Hierarchy comes from weight and size, not colour.">
        <div style={{background:'var(--canvas-card)', borderRadius:'var(--radius-card)', padding:24}}>
          <div style={{fontSize:'var(--fs-display)', fontWeight:400, letterSpacing:'-0.02em'}}>
            Display <strong style={{fontWeight:800}}>38px</strong>
          </div>
          <div style={{fontSize:'var(--fs-kpi)', fontWeight:800, letterSpacing:'-0.03em', marginTop:10}}>11,843</div>
          <div style={{fontSize:'var(--fs-title)', fontWeight:700, marginTop:10}}>Section title 22px</div>
          <div style={{fontSize:'var(--fs-card)', fontWeight:700, marginTop:8}}>Card title 16px</div>
          <div style={{fontSize:'var(--fs-body)', marginTop:8}}>Body 14px — the default for tables and forms.</div>
          <div style={{fontSize:'var(--fs-meta)', color:'var(--text3)', marginTop:8}}>Metadata 12px, muted.</div>
        </div>
      </Section>
    </div>
  );
}
