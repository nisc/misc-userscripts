// ==UserScript==
// @name         LinkedIn Dismiss Jobs
// @namespace    nisc
// @version      2026.03.01-A
// @description  Dismiss jobs by clicking buttons with matching aria-label
// @homepageURL  https://github.com/nisc/misc-userscripts
// @downloadURL  https://raw.githubusercontent.com/nisc/misc-userscripts/main/linkedin-dismiss.user.js
// @author       nisc
// @match        https://www.linkedin.com/jobs/search/*
// @match        https://www.linkedin.com/jobs/collections/recommended/*
// @icon         https://static.licdn.com/scds/common/u/images/logos/favicons/v1/favicon.ico
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function() {
  'use strict';

  const CLICK_DELAY_MS = 100;

  async function dismissJobs() {
    // Click all buttons with aria-label matching "dismiss .* job" (case insensitive).
    const buttons = Array.from(document.querySelectorAll('button')).filter(button => {
      const ariaLabel = button.getAttribute('aria-label');
      return ariaLabel && /dismiss .* job/i.test(ariaLabel);
    });

    if (buttons.length === 0) {
      console.log('No matching buttons found');
      alert('No matching buttons found');
      return;
    }

    console.log(`Found ${buttons.length} button(s) to click`);

    // Disable button during execution
    const btn = document.getElementById('dismiss-jobs-btn');
    let remaining = buttons.length;
    if (btn) {
      btn.disabled = true;
      btn.textContent = `${remaining} remaining...`;
    }

    for (const button of buttons) {
      try {
        button.click();
        console.log('Clicked button:', button.getAttribute('aria-label'));
        remaining--;
        if (btn) {
          btn.textContent = `${remaining} remaining...`;
        }
      } catch (error) {
        console.error('Error clicking button:', error);
      }
      await new Promise(resolve => setTimeout(resolve, CLICK_DELAY_MS));
    }

    console.log('Finished clicking all buttons');

    // Re-enable button
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Dismiss';
    }
  }

  function createButton() {
    // Check if button already exists
    if (document.getElementById('dismiss-jobs-btn')) {
      return;
    }

    const button = document.createElement('button');
    button.id = 'dismiss-jobs-btn';
    button.textContent = 'Dismiss';
    button.style.cssText = `
          position: fixed;
          bottom: 20px;
          left: 20px;
          z-index: 10000;
          padding: 10px 20px;
          background-color: #0a66c2;
          color: white;
          border: none;
          border-radius: 24px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          box-shadow: 0 2px 8px rgba(0,0,0,0.2);
          transition: background-color 0.2s;
      `;

    button.addEventListener('mouseenter', () => {
      button.style.backgroundColor = '#004182';
    });

    button.addEventListener('mouseleave', () => {
      button.style.backgroundColor = '#0a66c2';
    });

    button.addEventListener('click', dismissJobs);

    document.body.appendChild(button);
  }

  // Create button when page loads
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createButton);
  } else {
    createButton();
  }

  // Also create button after navigation (LinkedIn is a SPA)
  const observer = new MutationObserver(() => {
    if (window.location.href.startsWith('https://www.linkedin.com/jobs/search/') ||
      window.location.href.startsWith('https://www.linkedin.com/jobs/collections/recommended/')) {
      createButton();
    } else {
      // Remove button if we're not on the jobs search page
      const btn = document.getElementById('dismiss-jobs-btn');
      if (btn) {
        btn.remove();
      }
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  // Expose function to window for manual console access
  window.dismissJobs = dismissJobs;
})();
