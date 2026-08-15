/**
 * Stands in for @lit/react's createComponent.
 *
 * Real Material components are custom elements that need adopted stylesheets
 * and ElementInternals — neither exists in jsdom. Each wrapper becomes a plain
 * host element instead, keeping props, children and refs flowing so our own
 * layout and event wiring still render and can fail loudly if wrong.
 */
import React from 'react';

const PASSTHROUGH = new Set(['children', 'className', 'style', 'id', 'title', 'disabled', 'value', 'placeholder']);

export function createComponent({ tagName, events = {} }) {
  const Comp = React.forwardRef(({ children, ...props }, ref) => {
    const domProps = { ref, 'data-md': tagName };
    for (const [k, v] of Object.entries(props)) {
      if (PASSTHROUGH.has(k)) domProps[k] = v;
      // Event props (onChange, onClick…) are kept so handlers stay reachable.
      else if (k.startsWith('on') && typeof v === 'function') domProps[k] = v;
      else if (typeof v !== 'object' && typeof v !== 'function') domProps[`data-${k.toLowerCase()}`] = String(v);
    }
    // A div is valid anywhere these appear and never triggers jsdom's
    // "cannot appear as a descendant" warnings the way a button would.
    return React.createElement('div', domProps, children);
  });
  Comp.displayName = tagName;
  return Comp;
}
export default { createComponent };
