/** Trades someone can train, with the levels they may take as main and co-trainer. */
import { canTrainByTrade } from '../../utils/hrFit.js';
import { OCCUPATIONS } from '../../constants/data.js';

const short = (l) => (l === 'Professional' ? 'L4' : l.replace('Level ', 'L'));
const range = (ls) => ls.map(short).join(', ');

export default function CanTrain({ person, limit }) {
  const all = canTrainByTrade(person, OCCUPATIONS);
  if (!all.length) return null;
  const shown = limit ? all.slice(0, limit) : all;
  return (
    <div className="ct-list">
      {shown.map(t => (
        <div key={t.name} className="ct-line">
          <span className="ct-name">{t.name}</span>
          {t.levelled ? (<>
            {t.main.length > 0 && <span className="rule-trade-badge is-main" title="May lead as main trainer">Main {range(t.main)}</span>}
            <span className="rule-trade-badge is-co" title="May take as co-trainer">Co {range(t.co)}</span>
          </>) : <span className="rule-trade-badge is-main" title="No levels in this trade">Main &amp; co</span>}
        </div>
      ))}
      {all.length > shown.length && <span className="tw-hint">+{all.length - shown.length} more</span>}
    </div>
  );
}
