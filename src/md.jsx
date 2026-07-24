/**
 * Material Web 3 — React wrappers for @material/web components.
 * Import from this file everywhere instead of directly from @material/web.
 */
import React from 'react';
import { createComponent } from '@lit/react';

import { MdFilledButton }      from '@material/web/button/filled-button.js';
import { MdFilledTonalButton } from '@material/web/button/filled-tonal-button.js';
import { MdTextButton }        from '@material/web/button/text-button.js';
import { MdOutlinedButton }    from '@material/web/button/outlined-button.js';
import { MdIconButton }        from '@material/web/iconbutton/icon-button.js';
import { MdOutlinedTextField } from '@material/web/textfield/outlined-text-field.js';
import { MdOutlinedSelect }    from '@material/web/select/outlined-select.js';
import { MdSelectOption }      from '@material/web/select/select-option.js';
import { MdSwitch }            from '@material/web/switch/switch.js';
import { MdFilterChip }        from '@material/web/chips/filter-chip.js';
import { MdChipSet }           from '@material/web/chips/chip-set.js';
import { MdDialog }            from '@material/web/dialog/dialog.js';
import { MdTabs }              from '@material/web/tabs/tabs.js';
import { MdSecondaryTab }      from '@material/web/tabs/secondary-tab.js';

// ── Low-level wrapped elements ────────────────────────────────────────────
const _FilledBtn = createComponent({ tagName: 'md-filled-button',      elementClass: MdFilledButton,      react: React });
const _TonalBtn  = createComponent({ tagName: 'md-filled-tonal-button',elementClass: MdFilledTonalButton, react: React });
const _TextBtn   = createComponent({ tagName: 'md-text-button',        elementClass: MdTextButton,        react: React });
const _OutlBtn   = createComponent({ tagName: 'md-outlined-button',    elementClass: MdOutlinedButton,    react: React });
const _IconBtn   = createComponent({ tagName: 'md-icon-button',        elementClass: MdIconButton,        react: React });

// Text field: map React onChange → native 'input' event (real-time, like controlled inputs)
export const MdTextField = createComponent({
  tagName: 'md-outlined-text-field',
  elementClass: MdOutlinedTextField,
  react: React,
  events: { onChange: 'input', onBlur: 'blur', onFocus: 'focus', onKeyDown: 'keydown' },
});

// Select
export const MdSelect = createComponent({
  tagName: 'md-outlined-select',
  elementClass: MdOutlinedSelect,
  react: React,
  events: { onChange: 'change', onInput: 'input' },
});

export const MdOption = createComponent({
  tagName: 'md-select-option',
  elementClass: MdSelectOption,
  react: React,
});

// Switch
export const MdToggle = createComponent({
  tagName: 'md-switch',
  elementClass: MdSwitch,
  react: React,
  events: { onChange: 'change' },
});

// Chips
export const MdChip = createComponent({
  tagName: 'md-filter-chip',
  elementClass: MdFilterChip,
  react: React,
  events: { onClick: 'click' },
});

export const MdChips = createComponent({
  tagName: 'md-chip-set',
  elementClass: MdChipSet,
  react: React,
});

// Dialog — opened/closed via `open` boolean attribute
export const MdDialogEl = createComponent({
  tagName: 'md-dialog',
  elementClass: MdDialog,
  react: React,
  events: { onClose: 'close', onCancel: 'cancel', onOpen: 'open' },
});

// Tabs
export const MdTabBar = createComponent({
  tagName: 'md-tabs',
  elementClass: MdTabs,
  react: React,
  events: { onChange: 'change' },
});

export const MdTab = createComponent({
  tagName: 'md-secondary-tab',
  elementClass: MdSecondaryTab,
  react: React,
});

// ── Unified Btn component ─────────────────────────────────────────────────
// Drop-in replacement for <button className="btn btn-*">.
// Parses the existing className to pick the right Material Web button.
export function Btn({ className = '', children, style, ...rest }) {
  const has = (s) => className.includes(s);

  const sm      = has('btn-sm');
  const xs      = has('btn-xs');
  const isIcon  = has('btn-icon');
  const danger  = has('btn-danger');
  const ghost   = has('btn-ghost');
  const second  = has('btn-secondary');
  const success = has('btn-success');
  const warning = has('btn-warning');

  // Extra classes that aren't btn-* tokens (e.g. positional utils)
  const extra = className.split(' ').filter(c => !c.startsWith('btn')).join(' ').trim();
  const sizeAttr = sm ? 'sm' : xs ? 'xs' : '';
  const cls = [sizeAttr, extra].filter(Boolean).join(' ') || undefined;

  if (isIcon) return <_IconBtn className={extra || undefined} style={style} {...rest}>{children}</_IconBtn>;

  if (danger)  return <_TonalBtn  className={['danger', cls].filter(Boolean).join(' ')} style={style} {...rest}>{children}</_TonalBtn>;
  if (ghost)   return <_TextBtn   className={cls} style={style} {...rest}>{children}</_TextBtn>;
  if (second)  return <_TonalBtn  className={cls} style={style} {...rest}>{children}</_TonalBtn>;
  if (success) return <_FilledBtn className={['success', cls].filter(Boolean).join(' ')} style={style} {...rest}>{children}</_FilledBtn>;
  if (warning) return <_FilledBtn className={['warning', cls].filter(Boolean).join(' ')} style={style} {...rest}>{children}</_FilledBtn>;
  // primary (default)
  return <_FilledBtn className={cls} style={style} {...rest}>{children}</_FilledBtn>;
}
