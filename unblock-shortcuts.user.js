// ==UserScript==
// @name         Unblock Shortcuts
// @namespace    nisc
// @version      2025.09.24-A
// @description  Prevents sites from intercepting chosen browser/extension shortcuts so they work as intended
// @homepageURL  https://github.com/nisc/misc-userscripts
// @downloadURL  https://raw.githubusercontent.com/nisc/misc-userscripts/main/unblock-shortcuts.user.js
// @author       nisc
// @match        *://*/*
// @icon         https://www.mozilla.org/media/img/favicons/firefox/browser/favicon.f093404c0135.ico
// @run-at       document-start
// @grant        none
// ==/UserScript==

/**
 * Unblock Shortcuts Userscript
 *
 * Prevents web applications from intercepting chosen browser or extension keyboard shortcuts
 * so that the browser and extensions can receive and handle them.
 *
 * Features:
 * - Configurable host-specific shortcut definitions
 * - Captures keyboard events early (capture phase) before page handlers
 * - Stops event propagation without preventing default browser behavior
 */

(function() {
  'use strict';

  /**
   * Configure which shortcuts to unblock per host.
   * Each entry must include a `hosts` array and a `shortcuts` array.
   *
   * Host patterns:
   * - Exact string match against window.location.hostname
   * - Regular expression tested against hostname
   *
   * Shortcut descriptor fields:
   * - key: matches KeyboardEvent.key (case-insensitive for letters)
   * - code: matches KeyboardEvent.code (e.g., 'KeyR', 'Period')
   * - metaKey, ctrlKey, altKey, shiftKey: booleans to match modifiers
   *
   * At least one of `key` or `code` should be provided for each shortcut.
   */
  const SHORTCUT_CONFIG = [
    {
      hosts: [/(^|\.)docs\.google\.com$/],
      shortcuts: [
        // Shift+Cmd+.
        { metaKey: true, shiftKey: true, key: '.', code: 'Period' },
        // Shift+Cmd+,
        { metaKey: true, shiftKey: true, key: ',', code: 'Comma' },
        // Cmd+R
        { metaKey: true, key: 'r', code: 'KeyR' },
      ],
    },
    // {
    //   hosts: ['example.com', /(^|\.)example\.org$/],
    //   shortcuts: [
    //     // Example: Ctrl+P (open print dialog)
    //     { ctrlKey: true, key: 'p', code: 'KeyP' },
    //     // Example: Cmd+Alt+I (open dev tools)
    //     { metaKey: true, altKey: true, key: 'i', code: 'KeyI' },
    //   ],
    // },
  ];

  const hostname = window.location.hostname;

  /**
   * Determines whether a host pattern matches the current hostname.
   * @param {string|RegExp} pattern
   * @returns {boolean}
   */
  const hostMatches = (pattern) => {
    if (typeof pattern === 'string') {
      return pattern === hostname;
    }
    if (pattern instanceof RegExp) {
      return pattern.test(hostname);
    }
    return false;
  };

  const ACTIVE_SHORTCUTS = SHORTCUT_CONFIG.flatMap((entry) => {
    if (!entry || !Array.isArray(entry.shortcuts) || entry.shortcuts.length === 0) {
      return [];
    }
    const patterns = Array.isArray(entry.hosts) ? entry.hosts : [];
    if (patterns.length === 0) {
      return [];
    }
    const applies = patterns.some(hostMatches);
    return applies ? entry.shortcuts : [];
  });

  if (ACTIVE_SHORTCUTS.length === 0) {
    return;
  }

  /**
   * Checks whether a keyboard event matches a shortcut descriptor.
   * @param {KeyboardEvent} event
   * @param {Object} shortcut
   * @returns {boolean}
   */
  const eventMatchesShortcut = (event, shortcut) => {
    if (!shortcut) {
      return false;
    }

    if (typeof shortcut.metaKey === 'boolean' && event.metaKey !== shortcut.metaKey) return false;
    if (typeof shortcut.ctrlKey === 'boolean' && event.ctrlKey !== shortcut.ctrlKey) return false;
    if (typeof shortcut.altKey === 'boolean' && event.altKey !== shortcut.altKey) return false;
    if (typeof shortcut.shiftKey === 'boolean' && event.shiftKey !== shortcut.shiftKey) return false;

    const hasKey = typeof shortcut.key === 'string';
    const hasCode = typeof shortcut.code === 'string';
    if (!hasKey && !hasCode) {
      return false;
    }

    let keyMatches = true;
    if (hasKey) {
      const eventKey = typeof event.key === 'string' ? event.key.toLowerCase() : '';
      keyMatches = eventKey === shortcut.key.toLowerCase();
    }

    let codeMatches = true;
    if (hasCode) {
      codeMatches = event.code === shortcut.code;
    }

    return keyMatches || codeMatches;
  };

  /**
   * Stops propagation for specific shortcuts so pages cannot consume them.
   * Intentionally does NOT call preventDefault(), allowing browser/extension handling.
   * @param {KeyboardEvent} event
   */
  const interceptShortcut = (event) => {
    if (ACTIVE_SHORTCUTS.some((shortcut) => eventMatchesShortcut(event, shortcut))) {
      event.stopImmediatePropagation();
      event.stopPropagation();
    }
  };

  // Capture on keydown/keypress/keyup to out-prioritize page listeners.
  window.addEventListener('keydown', interceptShortcut, true);
  window.addEventListener('keypress', interceptShortcut, true);
  window.addEventListener('keyup', interceptShortcut, true);
})();
