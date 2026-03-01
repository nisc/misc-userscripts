// ==UserScript==
// @name         Credit Card Offers Activator
// @namespace    nisc
// @version      2026.03.01-C
// @description  Adds a button to activate all visible offers on Amex, Citi, and Chase offers pages
// @homepageURL  https://github.com/nisc/misc-userscripts
// @downloadURL  https://raw.githubusercontent.com/nisc/misc-userscripts/main/credit-card-offers-activator.user.js
// @author       nisc
// @match        https://global.americanexpress.com/offers*
// @match        https://online.citi.com/US/ag/products-offers/merchantoffers*
// @match        https://secure.chase.com/*
// @run-at       document-end
// @grant        none
// ==/UserScript==

/**
 * Credit Card Offers Activator
 *
 * Supported offers hubs:
 * - Amex: https://global.americanexpress.com/offers
 * - Citi: https://online.citi.com/US/ag/products-offers/merchantoffers
 * - Chase: https://secure.chase.com/web/auth/dashboard#/dashboard/merchantOffers/offer-hub
 *
 * This script adds a button. Clicking it attempts to click all
 * "add offer" style buttons currently visible on the page with short delays.
 */

// @ts-check

(function() {
  'use strict';

  if (window !== window.top) {
    return;
  }

  const BUTTON_ID = 'offers-activator-userscript-button';
  const STYLE_ID = 'offers-activator-userscript-style';

  const BUTTON_LABEL = 'Activate All Offers';
  const BUTTON_LABEL_RUNNING = 'Activating...';
  const BUTTON_TITLE_ACTIVE = 'Activate all visible offers';
  const BUTTON_TITLE_DISABLED = 'No activatable offers found';
  const BUTTON_TITLE_RUNNING = 'Activating Chase offers';

  const CLICK_INTERVAL_MS = 500;
  const FINAL_SETTLE_EXTRA_MS = 300;
  const MIN_FINAL_REFRESH_DELAY_MS = 250;
  const MUTATION_DEBOUNCE_MS = 120;
  const CHASE_NAVIGATION_TIMEOUT_MS = 12000;
  const CHASE_HUB_SETTLE_MS = 350;
  const CHASE_MAX_ITERATIONS = 500;
  const CHASE_STALL_LIMIT = 15;
  const CHASE_CLICK_SETTLE_MS = 150;
  const CHASE_POST_CLICK_NAV_WAIT_MS = 3500;
  const CHASE_TILE_ADD_WAIT_MS = 3000;
  const CHASE_SCROLL_WAIT_MS = 300;

  const MODE_INLINE = 'inline';
  const MODE_FLOATING = 'floating';
  const MODE_HIDDEN = 'hidden';

  const AMEX_INLINE_ANCHOR_SELECTOR = [
    '[data-testid="recommendedOffersHeader"] h1',
    '[data-testid="recommendedOffersHeader"] h2',
    '[data-testid="recommendedOffersHeader"] h3'
  ].join(', ');
  const AMEX_LEGACY_ANCHOR_SELECTOR = '[data-testid="addedToCardContainer"] span';
  const AMEX_ADDED_TO_CARD_PATTERN = /added to card/i;

  const ACTIVATION_TITLE_PATTERNS = [
    /add to card/i,
    /add to list card/i,
    /enroll in offer for/i
  ];
  const ACTIVATION_ARIA_LABEL_PATTERN = /add offer/i;
  const CHASE_TILE_SELECTOR = '[data-cy="commerce-tile"][role="button"]';
  const CHASE_TILE_ADD_ICON_SELECTOR = '[data-testid="commerce-tile-button"]';
  const CHASE_TILE_ADDED_SELECTOR = '[data-testid="offer-tile-alert-container-success"]';
  const CHASE_TILE_ADDED_TEXT_PATTERN = /success added/i;
  const CHASE_HUB_URL_PATTERN = /#\/dashboard\/merchantOffers\/offer-hub(?:\?|$)/i;
  const CHASE_ACTIVATED_URL_PATTERN = /#\/dashboard\/merchantOffers\/offer-activated\/[^?]+(?:\?|$)/i;

  const SITE_CONFIG = {
    amex: {
      id: 'amex',
      pattern: /https:\/\/global\.americanexpress\.com\/offers/i,
      placement: 'inline-or-hidden'
    },
    citi: {
      id: 'citi',
      pattern: /https:\/\/online\.citi\.com\/US\/ag\/products-offers\/merchantoffers/i,
      placement: 'floating'
    },
    chase: {
      id: 'chase',
      pattern: /https:\/\/secure\.chase\.com\/web\/auth\/dashboard#\/dashboard\/merchantOffers\/(?:offer-hub|offer-activated)/i,
      placement: 'floating'
    }
  };

  /** @type {{ buttonEl: HTMLButtonElement | null, currentMode: string | null, currentSiteId: string | null, lastHref: string, isChaseLoopRunning: boolean }} */
  const state = {
    buttonEl: null,
    currentMode: null,
    currentSiteId: null,
    lastHref: window.location.href,
    isChaseLoopRunning: false
  };

  /** @type {number | null} */
  let mutationDebounceTimer = null;

  function normalizeText(value) {
    return (value || '').trim().toLowerCase();
  }

  function isVisible(element) {
    if (!element || !element.isConnected) {
      return false;
    }

    const style = window.getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
      return false;
    }

    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function getCurrentSite() {
    const href = window.location.href;
    const sites = Object.values(SITE_CONFIG);
    return sites.find((site) => site.pattern.test(href)) || null;
  }

  function findAmexAddedToCardHeading() {
    const preferredHeading = Array.from(document.querySelectorAll(AMEX_INLINE_ANCHOR_SELECTOR)).find((heading) => {
      return AMEX_ADDED_TO_CARD_PATTERN.test(normalizeText(heading.textContent || ''));
    });

    if (preferredHeading) {
      return preferredHeading;
    }

    const legacyHeading = Array.from(document.querySelectorAll(AMEX_LEGACY_ANCHOR_SELECTOR)).find((span) => {
      return AMEX_ADDED_TO_CARD_PATTERN.test(normalizeText(span.textContent || ''));
    });

    return legacyHeading || null;
  }

  function getInlineAnchorForSite(site) {
    if (!site || site.id !== SITE_CONFIG.amex.id) {
      return null;
    }
    return findAmexAddedToCardHeading();
  }

  function getActivatorButton() {
    if (state.buttonEl && state.buttonEl.isConnected) {
      return state.buttonEl;
    }

    const existing = document.getElementById(BUTTON_ID);
    state.buttonEl = existing instanceof HTMLButtonElement ? existing : null;
    return state.buttonEl;
  }

  function getControlDescriptor(control) {
    const title = normalizeText(control.getAttribute('title'));
    const ariaLabel = normalizeText(control.getAttribute('aria-label'));
    const accessibleText = normalizeText(control.getAttribute('accessible-text'));
    const text = normalizeText(control.textContent || '');
    return { title, ariaLabel, accessibleText, text };
  }

  function isControlDisabled(control) {
    const ariaDisabled = normalizeText(control.getAttribute('aria-disabled')) === 'true';
    const inactive = normalizeText(control.getAttribute('inactive')) === 'true';

    if (ariaDisabled || inactive) {
      return true;
    }

    if (control instanceof HTMLButtonElement) {
      return control.disabled;
    }

    return false;
  }

  function matchesAddOfferIntent(control) {
    const { title, ariaLabel, accessibleText, text } = getControlDescriptor(control);

    const hasActivationClass =
      control.classList.contains('mn_button') &&
      control.classList.contains('mn_linkOffer');

    const matchesTitle = ACTIVATION_TITLE_PATTERNS.some((pattern) => pattern.test(title));
    const matchesAria =
      ACTIVATION_ARIA_LABEL_PATTERN.test(ariaLabel) ||
      ACTIVATION_ARIA_LABEL_PATTERN.test(accessibleText) ||
      ACTIVATION_ARIA_LABEL_PATTERN.test(text);

    return matchesTitle || matchesAria || hasActivationClass;
  }

  function getGenericActivatableControls() {
    return Array.from(document.querySelectorAll('button, mds-button')).filter((control) => {
      if (!(control instanceof HTMLElement)) {
        return false;
      }

      if (isControlDisabled(control) || !isVisible(control)) {
        return false;
      }

      return matchesAddOfferIntent(control);
    });
  }

  function isChaseTileAlreadyAdded(tile) {
    if (tile.querySelector(CHASE_TILE_ADDED_SELECTOR)) {
      return true;
    }

    const ariaLabel = normalizeText(tile.getAttribute('aria-label'));
    return CHASE_TILE_ADDED_TEXT_PATTERN.test(ariaLabel);
  }

  function getChaseActivatableTiles() {
    return Array.from(document.querySelectorAll(CHASE_TILE_SELECTOR)).filter((tile) => {
      if (!(tile instanceof HTMLElement)) {
        return false;
      }

      if (isControlDisabled(tile) || !isVisible(tile)) {
        return false;
      }

      if (isChaseTileAlreadyAdded(tile)) {
        return false;
      }

      // Current Chase offer cards expose a plus icon when activation is available.
      return tile.querySelector(CHASE_TILE_ADD_ICON_SELECTOR) !== null;
    });
  }

  function getActivatableOfferControls() {
    const site = getCurrentSite();
    const genericControls = getGenericActivatableControls();

    if (site && site.id === SITE_CONFIG.chase.id) {
      const chaseTiles = getChaseActivatableTiles();
      return [...genericControls, ...chaseTiles];
    }

    return genericControls;
  }

  function isChaseOfferHubUrl() {
    return CHASE_HUB_URL_PATTERN.test(window.location.href);
  }

  function isChaseOfferActivatedUrl() {
    return CHASE_ACTIVATED_URL_PATTERN.test(window.location.href);
  }

  function getChaseAccountIdFromUrl(href = window.location.href) {
    const match = href.match(/[?&]accountId=([^&#]+)/i);
    if (!match || !match[1]) {
      return '';
    }

    try {
      return decodeURIComponent(match[1]);
    } catch (_) {
      return match[1];
    }
  }

  function buildChaseOfferHubUrl() {
    const baseUrl = window.location.href.split('#')[0] + '#/dashboard/merchantOffers/offer-hub';
    const accountId = getChaseAccountIdFromUrl();
    return accountId ? baseUrl + '?accountId=' + encodeURIComponent(accountId) : baseUrl;
  }

  function sleep(ms) {
    return new Promise((resolve) => {
      window.setTimeout(resolve, ms);
    });
  }

  async function waitForCondition(conditionFn, timeoutMs) {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      if (conditionFn()) {
        return true;
      }
      await sleep(100);
    }

    return conditionFn();
  }

  async function ensureChaseOfferHub() {
    if (isChaseOfferHubUrl()) {
      return true;
    }

    if (isChaseOfferActivatedUrl()) {
      window.history.back();
      const returnedToHub = await waitForCondition(isChaseOfferHubUrl, CHASE_NAVIGATION_TIMEOUT_MS);
      if (returnedToHub) {
        await sleep(CHASE_HUB_SETTLE_MS);
        return true;
      }
    }

    window.location.assign(buildChaseOfferHubUrl());
    const reachedHub = await waitForCondition(isChaseOfferHubUrl, CHASE_NAVIGATION_TIMEOUT_MS);
    if (reachedHub) {
      await sleep(CHASE_HUB_SETTLE_MS);
    }
    return reachedHub;
  }

  function getNextChaseActivatableTile() {
    const tiles = getChaseActivatableTiles();
    return tiles.length > 0 ? tiles[0] : null;
  }

  async function tryLoadMoreChaseTiles() {
    if (getNextChaseActivatableTile()) {
      return true;
    }

    const previousY = window.scrollY;
    const scrollDelta = Math.max(Math.round(window.innerHeight * 0.9), 500);
    window.scrollBy({ top: scrollDelta, behavior: 'auto' });
    await sleep(CHASE_SCROLL_WAIT_MS);

    if (getNextChaseActivatableTile()) {
      return true;
    }

    if (window.scrollY === previousY) {
      await sleep(CHASE_SCROLL_WAIT_MS);
      return getNextChaseActivatableTile() !== null;
    }

    return false;
  }

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) {
      return;
    }

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = [
      '.offers-activator-button {',
      '  position: fixed;',
      '  right: 16px;',
      '  bottom: 16px;',
      '  z-index: 2147483647;',
      '  padding: 10px 14px;',
      '  border: 1px solid #1f2937;',
      '  border-radius: 8px;',
      '  background: #111827;',
      '  color: #ffffff;',
      '  font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;',
      '  font-size: 14px;',
      '  font-weight: 600;',
      '  cursor: pointer;',
      '  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.25);',
      '}',
      '.offers-activator-button--floating {',
      '  display: inline-flex;',
      '  margin-left: 0;',
      '  margin-top: 0;',
      '}',
      '.offers-activator-button--inline {',
      '  display: inline-flex;',
      '  position: static;',
      '  align-items: center;',
      '  right: auto;',
      '  bottom: auto;',
      '  margin-left: 10px;',
      '  margin-top: 0;',
      '  z-index: 1;',
      '  padding: 6px 12px;',
      '  font-size: 14px;',
      '  font-weight: 500;',
      '  border: 1px solid #b5d7f4;',
      '  border-radius: 8px;',
      '  background: #edf7ff;',
      '  color: #006fcf;',
      '  box-shadow: none;',
      '}',
      '.offers-activator-button--hidden {',
      '  display: none;',
      '}',
      '.offers-activator-button--disabled {',
      '  cursor: not-allowed;',
      '  opacity: 0.55;',
      '}'
    ].join('\n');

    (document.head || document.documentElement).appendChild(style);
  }

  function applyFloatingMode(button) {
    if (button.parentElement !== document.body) {
      document.body.appendChild(button);
    }

    button.classList.remove('offers-activator-button--inline', 'offers-activator-button--hidden');
    button.classList.add('offers-activator-button--floating');
    state.currentMode = MODE_FLOATING;
  }

  function applyInlineMode(button, anchor) {
    if (anchor && button.parentElement !== anchor) {
      anchor.appendChild(button);
    }

    button.classList.remove('offers-activator-button--floating', 'offers-activator-button--hidden');
    button.classList.add('offers-activator-button--inline');
    state.currentMode = MODE_INLINE;
  }

  function applyHiddenMode(button) {
    button.classList.remove('offers-activator-button--floating', 'offers-activator-button--inline');
    button.classList.add('offers-activator-button--hidden');
    state.currentMode = MODE_HIDDEN;
  }

  function updateActivatorButtonState(button = getActivatorButton()) {
    if (!button) {
      return;
    }

    if (state.isChaseLoopRunning) {
      button.disabled = true;
      button.title = BUTTON_TITLE_RUNNING;
      button.textContent = BUTTON_LABEL_RUNNING;
      button.classList.add('offers-activator-button--disabled');
      return;
    }

    const remainingOffers = getActivatableOfferControls().length;
    const hasRemainingOffers = remainingOffers > 0;

    button.disabled = !hasRemainingOffers;
    button.title = hasRemainingOffers ? BUTTON_TITLE_ACTIVE : BUTTON_TITLE_DISABLED;
    button.textContent = BUTTON_LABEL;
    button.classList.toggle('offers-activator-button--disabled', !hasRemainingOffers);
  }

  function positionActivatorButton(button, site) {
    if (!site) {
      return;
    }

    if (site.placement === 'inline-or-hidden') {
      const anchor = getInlineAnchorForSite(site);
      if (anchor) {
        applyInlineMode(button, anchor);
      } else {
        // Keep Amex button hidden until we can place it beside the heading.
        applyHiddenMode(button);
      }
      updateActivatorButtonState(button);
      return;
    }

    applyFloatingMode(button);
    updateActivatorButtonState(button);
  }

  function clickOfferButtons() {
    const site = getCurrentSite();
    if (site && site.id === SITE_CONFIG.chase.id) {
      void runChaseActivationLoop();
      return;
    }

    const controls = getActivatableOfferControls();

    controls.forEach((control, index) => {
      const delay = index * CLICK_INTERVAL_MS;
      setTimeout(() => {
        try {
          control.click();
        } catch (_) {
          // Ignore stale or blocked elements and continue with others.
        } finally {
          updateActivatorButtonState();
        }
      }, delay);
    });

    const queuedCount = controls.length;
    const finalDelay = Math.max(
      MIN_FINAL_REFRESH_DELAY_MS,
      queuedCount * CLICK_INTERVAL_MS + FINAL_SETTLE_EXTRA_MS
    );
    setTimeout(() => {
      updateActivatorButtonState();
    }, finalDelay);
  }

  async function runChaseActivationLoop() {
    if (state.isChaseLoopRunning) {
      return;
    }

    state.isChaseLoopRunning = true;
    updateActivatorButtonState();

    try {
      let stallCount = 0;

      for (let i = 0; i < CHASE_MAX_ITERATIONS; i += 1) {
        const onHub = await ensureChaseOfferHub();
        if (!onHub) {
          break;
        }

        let tile = getNextChaseActivatableTile();
        if (!tile) {
          const loadedMore = await tryLoadMoreChaseTiles();
          tile = getNextChaseActivatableTile();

          if (!tile) {
            if (!loadedMore) {
              break;
            }

            stallCount += 1;
            if (stallCount >= CHASE_STALL_LIMIT) {
              break;
            }
            continue;
          }
        }

        const tileId = tile.id || '';
        tile.scrollIntoView({ block: 'center', inline: 'nearest' });
        await sleep(CHASE_CLICK_SETTLE_MS);
        tile.click();

        const navigatedAwayFromHub = await waitForCondition(() => !isChaseOfferHubUrl(), CHASE_POST_CLICK_NAV_WAIT_MS);

        if (navigatedAwayFromHub) {
          const backOnHub = await ensureChaseOfferHub();
          if (!backOnHub) {
            stallCount += 1;
            if (stallCount >= CHASE_STALL_LIMIT) {
              break;
            }
            continue;
          }
        } else if (tileId) {
          await waitForCondition(() => {
            const current = document.getElementById(tileId);
            return !current || isChaseTileAlreadyAdded(current);
          }, CHASE_TILE_ADD_WAIT_MS);
        }

        stallCount = 0;
        await sleep(CHASE_HUB_SETTLE_MS);
      }
    } finally {
      state.isChaseLoopRunning = false;
      updateActivatorButtonState();
    }
  }

  function createButtonElement() {
    const button = document.createElement('button');
    button.id = BUTTON_ID;
    button.type = 'button';
    button.textContent = BUTTON_LABEL;
    button.className = 'offers-activator-button offers-activator-button--floating';
    button.title = BUTTON_TITLE_ACTIVE;
    button.addEventListener('click', clickOfferButtons);
    return button;
  }

  function ensureActivatorButton() {
    const site = getCurrentSite();
    state.currentSiteId = site ? site.id : null;
    state.lastHref = window.location.href;

    if (!site) {
      return;
    }

    ensureStyles();

    let button = getActivatorButton();
    if (!button) {
      button = createButtonElement();
      state.buttonEl = button;
      document.body.appendChild(button);
    }

    positionActivatorButton(button, site);
  }

  function scheduleEnsureActivatorButton() {
    if (mutationDebounceTimer !== null) {
      window.clearTimeout(mutationDebounceTimer);
    }

    mutationDebounceTimer = window.setTimeout(() => {
      mutationDebounceTimer = null;
      ensureActivatorButton();
    }, MUTATION_DEBOUNCE_MS);
  }

  function initialize() {
    if (document.body) {
      ensureActivatorButton();
    } else {
      window.addEventListener('DOMContentLoaded', ensureActivatorButton, { once: true });
    }

    // Handle SPA navigation (especially Chase hash/dashboard transitions).
    window.addEventListener('hashchange', ensureActivatorButton);
    window.addEventListener('popstate', ensureActivatorButton);

    // Reposition when dynamic page content (like Amex offers sections) mounts.
    const observer = new MutationObserver(() => {
      scheduleEnsureActivatorButton();
    });
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  }

  initialize();
})();
