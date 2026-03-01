// ==UserScript==
// @name         Credit Card Offers Activator
// @namespace    nisc
// @version      2026.03.01-A
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
 * This script adds a floating button. Clicking it attempts to click all
 * "add offer" style buttons currently visible on the page with short delays.
 */

(function() {
  'use strict';

  if (window !== window.top) {
    return;
  }

  const SUPPORTED_LOCATIONS = [
    /https:\/\/global\.americanexpress\.com\/offers/i,
    /https:\/\/online\.citi\.com\/US\/ag\/products-offers\/merchantoffers/i,
    /https:\/\/secure\.chase\.com\/web\/auth\/dashboard#\/dashboard\/merchantOffers\/offer-hub/i
  ];

  const BUTTON_ID = 'offers-activator-userscript-button';

  function isSupportedLocation() {
    return SUPPORTED_LOCATIONS.some((pattern) => pattern.test(window.location.href));
  }

  function isAmexLocation() {
    return /https:\/\/global\.americanexpress\.com\/offers/i.test(window.location.href);
  }

  function findAmexAddedToCardHeading() {
    const preferredHeading = Array.from(
      document.querySelectorAll('[data-testid="recommendedOffersHeader"] h1, [data-testid="recommendedOffersHeader"] h2, [data-testid="recommendedOffersHeader"] h3')
    ).find((heading) => /added to card/i.test((heading.textContent || '').trim()));

    if (preferredHeading) {
      return preferredHeading;
    }

    const legacyHeading = Array.from(
      document.querySelectorAll('[data-testid="addedToCardContainer"] span')
    ).find((span) => /added to card/i.test((span.textContent || '').trim()));

    return legacyHeading || null;
  }

  function isElementVisible(element) {
    if (!element || !element.isConnected) {
      return false;
    }

    const style = window.getComputedStyle(element);
    if (
      style.display === 'none' ||
      style.visibility === 'hidden' ||
      style.opacity === '0'
    ) {
      return false;
    }

    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function getActivatableOfferButtons() {
    return Array.from(document.querySelectorAll('button')).filter((button) => {
      const title = button.getAttribute('title') || '';
      const ariaLabel = button.getAttribute('aria-label') || '';
      const hasClass = button.classList.contains('mn_button') && button.classList.contains('mn_linkOffer');
      const ariaDisabled = (button.getAttribute('aria-disabled') || '').toLowerCase() === 'true';

      if (button.disabled || ariaDisabled || !isElementVisible(button)) {
        return false;
      }

      return (
        /add to card/i.test(title) ||
        /add to list card/i.test(title) ||
        /enroll in offer for/i.test(title) ||
        /add offer/i.test(ariaLabel) ||
        hasClass
      );
    });
  }

  function updateActivatorButtonState(button) {
    if (!button) {
      return;
    }

    const remainingOffers = getActivatableOfferButtons().length;
    const hasRemainingOffers = remainingOffers > 0;

    button.disabled = !hasRemainingOffers;
    button.style.cursor = hasRemainingOffers ? 'pointer' : 'not-allowed';
    button.style.opacity = hasRemainingOffers ? '1' : '0.55';
    button.title = hasRemainingOffers ? 'Activate all visible offers' : 'No activatable offers found';
  }

  function positionActivatorButton(button) {
    const amexHeading = findAmexAddedToCardHeading();
    if (amexHeading) {
      if (button.parentElement !== amexHeading) {
        amexHeading.appendChild(button);
      }
      button.style.position = 'static';
      button.style.display = 'inline-flex';
      button.style.alignItems = 'center';
      button.style.right = '';
      button.style.bottom = '';
      button.style.marginLeft = '10px';
      button.style.marginTop = '0';
      button.style.zIndex = '1';
      button.style.padding = '6px 12px';
      button.style.fontSize = '14px';
      button.style.fontWeight = '500';
      button.style.border = '1px solid #b5d7f4';
      button.style.borderRadius = '8px';
      button.style.background = '#edf7ff';
      button.style.color = '#006fcf';
      button.style.boxShadow = 'none';
      updateActivatorButtonState(button);
      return;
    }

    if (isAmexLocation()) {
      // On Amex, avoid showing a temporary floating button before the
      // header mounts; keep it hidden until we can place it inline.
      button.style.display = 'none';
      return;
    }

    if (button.parentElement !== document.body) {
      document.body.appendChild(button);
    }
    button.style.display = 'inline-flex';
    button.style.position = 'fixed';
    button.style.right = '16px';
    button.style.bottom = '16px';
    button.style.marginLeft = '0';
    button.style.marginTop = '0';
    button.style.zIndex = '2147483647';
    button.style.padding = '10px 14px';
    button.style.fontSize = '14px';
    button.style.fontWeight = '600';
    button.style.border = '1px solid #1f2937';
    button.style.borderRadius = '8px';
    button.style.background = '#111827';
    button.style.color = '#ffffff';
    button.style.boxShadow = '0 6px 20px rgba(0, 0, 0, 0.25)';
    updateActivatorButtonState(button);
  }

  function clickOfferButtons() {
    const buttons = getActivatableOfferButtons();
    let clickIndex = 0;

    buttons.forEach((button) => {
      const delay = clickIndex * 500;
      clickIndex += 1;
      setTimeout(() => {
        try {
          button.click();
        } catch (_) {
          // Ignore stale or blocked elements and continue with others.
        } finally {
          const activatorButton = document.getElementById(BUTTON_ID);
          updateActivatorButtonState(activatorButton);
        }
      }, delay);
    });

    // Refresh once after queued clicks should have settled.
    const finalDelay = Math.max(250, clickIndex * 500 + 300);
    setTimeout(() => {
      const activatorButton = document.getElementById(BUTTON_ID);
      updateActivatorButtonState(activatorButton);
    }, finalDelay);
  }

  function createActivatorButton() {
    if (!isSupportedLocation()) {
      return;
    }

    // On Amex, wait until we can place the button beside the "Added to Card"
    // heading so it does not render in a temporary floating position.
    if (isAmexLocation() && !findAmexAddedToCardHeading()) {
      const existingAmexButton = document.getElementById(BUTTON_ID);
      if (existingAmexButton) {
        existingAmexButton.style.display = 'none';
      }
      return;
    }

    const existingButton = document.getElementById(BUTTON_ID);
    if (existingButton) {
      positionActivatorButton(existingButton);
      return;
    }

    const button = document.createElement('button');
    button.id = BUTTON_ID;
    button.type = 'button';
    button.textContent = 'Activate All Offers';
    button.style.position = 'fixed';
    button.style.right = '16px';
    button.style.bottom = '16px';
    button.style.zIndex = '2147483647';
    button.style.padding = '10px 14px';
    button.style.border = '1px solid #1f2937';
    button.style.borderRadius = '8px';
    button.style.background = '#111827';
    button.style.color = '#ffffff';
    button.style.fontFamily = 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
    button.style.fontSize = '14px';
    button.style.fontWeight = '600';
    button.style.cursor = 'pointer';
    button.style.boxShadow = '0 6px 20px rgba(0, 0, 0, 0.25)';

    button.addEventListener('click', clickOfferButtons);
    document.body.appendChild(button);
    positionActivatorButton(button);
  }

  function initialize() {
    if (document.body) {
      createActivatorButton();
    } else {
      window.addEventListener('DOMContentLoaded', createActivatorButton, { once: true });
    }

    // Handle SPA navigation (especially Chase hash/dashboard transitions).
    window.addEventListener('hashchange', createActivatorButton);
    window.addEventListener('popstate', createActivatorButton);

    // Reposition when dynamic page content (like Amex offers sections) mounts.
    const observer = new MutationObserver(() => {
      createActivatorButton();
    });
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  }

  initialize();
})();
