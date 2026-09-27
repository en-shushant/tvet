import { describe, it, expect } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act, useState } from 'react';
import SuggestInput from '../src/components/ui/SuggestInput.jsx';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const NAMES = ['Bachelor in Civil Engineering', 'Bachelor in Education', 'Diploma in Civil Engineering'];

function Harness({ onValue }) {
  const [v, setV] = useState('');
  return <SuggestInput value={v} suggestions={NAMES} onChange={x => { setV(x); onValue(x); }}/>;
}

describe('SuggestInput', () => {
  it('suggests, filters and fills only when chosen', async () => {
    const seen = [];
    const el = document.createElement('div'); document.body.appendChild(el);
    const root = createRoot(el);
    await act(async () => root.render(<Harness onValue={v => seen.push(v)}/>));
    const input = el.querySelector('input');
    const list = () => [...document.querySelectorAll('.sel-list [role=option]')].map(o => o.textContent);

    await act(async () => { input.focus(); input.dispatchEvent(new FocusEvent('focus', { bubbles: true })); });
    expect(input.value).toBe('');                 // focusing never fills anything
    expect(seen).toEqual([]);

    const type = async (v) => act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, v);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await type('bach');
    expect(list()).toEqual(['Bachelor in Civil Engineering', 'Bachelor in Education']);
    expect(input.value).toBe('bach');

    await act(async () => input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })));
    await act(async () => input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })));
    await act(async () => input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })));
    expect(input.value).toBe('Bachelor in Education');

    await type('civil');
    await act(async () => [...document.querySelectorAll('.sel-list [role=option]')][1].click());
    expect(input.value).toBe('Diploma in Civil Engineering');
    expect(list()).toEqual([]);                    // closed after choosing

    await act(async () => root.unmount()); el.remove();
  });
});
