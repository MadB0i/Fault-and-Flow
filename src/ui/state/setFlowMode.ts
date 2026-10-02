/**
 * Selecting the built FLOW channel.
 *
 * A module-level function rather than a `useUiStore.getState()` call at two
 * call sites: the store is a hook-created object, so reaching into it from
 * outside React is what the hook rules exist to prevent. This is the one place
 * that does it, so the rule has one exemption with a name.
 */

import { useUiStore } from './useUiStore.js';

export function setFlowMode(): void {
  useUiStore.getState().setMode('flow');
}
