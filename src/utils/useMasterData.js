/**
 * React access to the mutable master-data arrays.
 *
 * OCCUPATIONS and PROVINCES cannot simply become state: utils/format.js,
 * utils/api.js and every report family import and read them outside React.
 * useSyncExternalStore is the right tool for exactly this — external mutable
 * state that React must observe without owning.
 *
 * Each hook returns a fresh array only when the data actually changes, so the
 * identity is stable between mutations and safe to use as a useMemo dependency,
 * while a change reliably invalidates anything derived from it.
 */
import { useSyncExternalStore, useMemo } from 'react';
import {
  OCCUPATIONS, PROVINCES,
  subscribeMasterData, getMasterDataVersion,
} from '../constants/data.js';

/** Re-renders when master data changes. Returns the version, for memo deps. */
export function useMasterDataVersion() {
  return useSyncExternalStore(
    subscribeMasterData,
    getMasterDataVersion,
    getMasterDataVersion, // server snapshot — same value, nothing is async here
  );
}

export function useOccupations() {
  const version = useMasterDataVersion();
  return useMemo(() => OCCUPATIONS.slice(), [version]);
}

export function useProvinces() {
  const version = useMasterDataVersion();
  return useMemo(() => PROVINCES.slice(), [version]);
}
