// ==UserScript==
// @name         LinkedIn Tweaks
// @namespace    nisc
// @version      2025.09.25-A
// @description  Various usability improvements for LinkedIn
// @homepageURL  https://github.com/nisc/misc-userscripts
// @downloadURL  https://raw.githubusercontent.com/nisc/misc-userscripts/main/linkedin-tweaks.user.js
// @author       nisc
// @match        https://www.linkedin.com/*
// @icon         https://static.licdn.com/scds/common/u/images/logos/favicons/v1/favicon.ico
// @run-at       document-end
// @grant        none
// ==/UserScript==

/**
 * LinkedIn Tweaks – Work in progress
 *
 * Example functionality currently implemented:
 * - Automatically closes the job "post-apply" confirmation modal after a short delay
 * - Hooks into LinkedIn's single-page navigation to keep the script active
 * - Retries safely if the modal is still visible after the first click
 */

(function() {
  'use strict';

  const TARGET_URL_PATTERN = /^https:\/\/www\.linkedin\.com\/jobs\/[^\s]*\/post-apply\//;
  const DISMISS_BUTTON_SELECTOR = 'button.artdeco-modal__dismiss[aria-label="Dismiss"]';
  const CLICK_DELAY_MS = 250;
  const POLL_INTERVAL_MS = 250;
  const RETRY_DELAY_MS = 500;

  const buttonState = new WeakMap();
  let intervalId = null;
  let mutationObserver = null;

  /**
   * Schedules a delayed click on the dismiss button if it has not already been handled.
   * @param {HTMLButtonElement} button
   */
  const scheduleDismiss = (button) => {
    const state = buttonState.get(button);
    if (state === 'pending' || state === 'done') {
      return;
    }

    buttonState.set(button, 'pending');

    setTimeout(() => {
      if (!button.isConnected) {
        buttonState.delete(button);
        return;
      }
      if (!matchesTargetLocation()) {
        buttonState.delete(button);
        return;
      }

      if (!fireClick(button)) {
        buttonState.delete(button);
        return;
      }

      setTimeout(() => {
        if (!button.isConnected || !button.offsetParent) {
          buttonState.set(button, 'done');
          return;
        }

        // Modal still visible, retry once more.
        buttonState.delete(button);
        scheduleDismiss(button);
      }, RETRY_DELAY_MS);
    }, CLICK_DELAY_MS);
  };

  const fireClick = (button) => {
    try {
      const events = [
        new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerId: 1, pointerType: 'mouse' }),
        new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }),
        new PointerEvent('pointerup', { bubbles: true, cancelable: true, pointerId: 1, pointerType: 'mouse' }),
        new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }),
        new MouseEvent('click', { bubbles: true, cancelable: true, view: window })
      ];
      for (const event of events) {
        button.dispatchEvent(event);
      }
      return true;
    } catch (_) {
      try {
        button.click();
        return true;
      } catch (_error) {
        return false;
      }
    }
  };

  /**
   * Checks current URL and DOM for the dismiss button to schedule the click.
   */
  const checkForDismissButton = () => {
    if (!matchesTargetLocation()) {
      return;
    }

    const button = document.querySelector(DISMISS_BUTTON_SELECTOR);
    if (button instanceof HTMLButtonElement) {
      scheduleDismiss(button);
    }
  };

  const matchesTargetLocation = () => {
    return TARGET_URL_PATTERN.test(window.location.href);
  };

  const startMonitoring = () => {
    checkForDismissButton();
    if (intervalId !== null) {
      clearInterval(intervalId);
    }
    intervalId = setInterval(checkForDismissButton, POLL_INTERVAL_MS);
  };

  const refreshHandlers = () => {
    startMonitoring();
    observeMutations();
  };

  const observeMutations = () => {
    if (mutationObserver instanceof MutationObserver) {
      mutationObserver.disconnect();
    }

    mutationObserver = new MutationObserver(() => {
      if (matchesTargetLocation()) {
        checkForDismissButton();
      }
    });

    const attach = () => {
      mutationObserver.observe(document.body, { childList: true, subtree: true });
    };

    if (document.body) {
      attach();
    } else {
      window.addEventListener('DOMContentLoaded', attach, { once: true });
    }
  };

  const wrapHistoryMethod = (method) => {
    const original = history[method];
    if (typeof original !== 'function') {
      return;
    }
    history[method] = function wrappedHistoryMethod(...args) {
      const result = original.apply(this, args);
      queueMicrotask(refreshHandlers);
      return result;
    };
  };

  window.addEventListener('popstate', refreshHandlers);
  wrapHistoryMethod('pushState');
  wrapHistoryMethod('replaceState');
  refreshHandlers();
})();
