// ==UserScript==
// @name         Duplicate Tab
// @namespace    nisc
// @version      2025.09.24-A
// @description  Adds a cross-browser keyboard shortcut (Shift+⌘/Ctrl+E) to duplicate the current tab
// @homepageURL  https://github.com/nisc/misc-userscripts
// @downloadURL  https://raw.githubusercontent.com/nisc/misc-userscripts/main/duplicate-tab.user.js
// @author       nisc
// @match        *://*/*
// @icon         https://www.mozilla.org/media/img/favicons/firefox/browser/favicon.f093404c0135.ico
// @run-at       document-start
// @grant        none
// ==/UserScript==

/**
 * Duplicate Tab Userscript
 *
 * This userscript adds a keyboard shortcut to duplicate the current browser tab
 * while preserving the scroll position. It's particularly useful when you want to
 * keep your place in a long article or document while opening it in a new tab.
 *
 * Features:
 * - Cross-platform keyboard shortcuts (Shift+⌘+E on macOS, Ctrl+Shift+E elsewhere)
 * - Preserves scroll position in the duplicated tab
 * - Cleans up the URL after duplication (removes tracking parameter)
 * - Only runs in main window (not in iframes)
 * - Works on any webpage
 *
 * Technical Details:
 * - Uses window.open() for tab creation
 * - Leverages window.opener for scroll position transfer
 * - Handles URL parameters cleanly via URLSearchParams
 * - Uses platform detection for appropriate keyboard shortcuts
 */

(function() {
  'use strict';

  // Only run in main window, not in iframes
  if (window !== window.top) {
    return;
  }

  // Configuration constants
  const CONFIG = {
    SHORTCUT_KEY: 'KeyE',
    URL_PARAM: 'my-user-script-duplicate',
    URL_PARAM_VALUE: 'true',
    IS_MAC: /^Mac/i.test(navigator.platform)
  };

  /**
   * Handles keyboard shortcuts for tab duplication
   * @param {KeyboardEvent} event - The keyboard event
   */
  function handleKeyboardShortcut(event) {
    const modifierPressed = CONFIG.IS_MAC ? event.metaKey : event.ctrlKey;

    if (modifierPressed && event.shiftKey && event.code === CONFIG.SHORTCUT_KEY) {
      event.preventDefault();
      event.stopPropagation();
      const url = new URL(window.location.href);
      url.searchParams.set(CONFIG.URL_PARAM, CONFIG.URL_PARAM_VALUE);
      window.open(url.toString(), '_blank');
    }
  }

  /**
   * Handles initialization of a duplicated tab:
   * - Checks if this is a duplicated tab
   * - Restores scroll position if applicable
   * - Cleans up the URL by removing the duplication parameter
   */
  function handleDuplicatedTab() {
    const params = new URLSearchParams(window.location.search);
    const isDuplicate = params.get(CONFIG.URL_PARAM) === CONFIG.URL_PARAM_VALUE;

    if (isDuplicate && window.opener) {
      // Clean up URL first
      params.delete(CONFIG.URL_PARAM);
      const newSearch = params.toString();
      const newUrl = window.location.pathname +
        (newSearch ? '?' + newSearch : '') +
        window.location.hash;
      history.replaceState(null, '', newUrl);

      // Restore scroll position when the page is ready
      if (document.readyState === 'complete') {
        window.scrollTo(0, window.opener.scrollY);
      } else {
        window.addEventListener('load', function() {
          window.scrollTo(0, window.opener.scrollY);
        });
      }
    }
  }

  // Initialize
  document.addEventListener('keydown', handleKeyboardShortcut, true);
  handleDuplicatedTab();
})();
