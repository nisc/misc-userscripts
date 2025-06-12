// ==UserScript==
// @name         YouTube - Invidious Redirect
// @namespace    nisc
// @version      2025.06.11-A
// @description  Always redirects YouTube watch pages to a random Invidious instance
// @homepageURL  https://github.com/nisc/misc-userscripts
// @downloadURL  https://raw.githubusercontent.com/nisc/misc-userscripts/main/youtube-invidious-redirect.user.js
// @author       nisc
// @match        https://www.youtube.com/watch?*
// @icon         https://www.youtube.com/favicon.ico
// @run-at       document-start
// @grant        none
// ==/UserScript==

/**
 * YouTube - Invidious Redirect Userscript
 *
 * This userscript automatically redirects YouTube watch pages to a random Invidious instance,
 * providing a more privacy-focused alternative to watching YouTube videos.
 *
 * Features:
 * - Automatic redirection from YouTube to Invidious
 * - Random instance selection for load balancing
 * - Preserves video ID and parameters
 * - Runs at document-start for immediate redirection
 * - Works on all YouTube watch pages
 *
 * Technical Details:
 * - Uses window.location.replace for clean redirection
 * - Maintains a list of reliable Invidious instances
 * - Extracts video ID using regex pattern matching
 * - Handles URL parameters cleanly
 */

(function() {
    'use strict';

    // List of reliable Invidious instances
    // Source: https://docs.invidious.io/instances/
    const INVIDIOUS_INSTANCES = [
        "https://yewtu.be",
        "https://inv.nadeko.net",
        "https://invidious.nerdvpn.de",
        "https://invidious.tiekoetter.com",
    ];

    /**
     * Selects a random Invidious instance from the list
     * @returns {string} The selected instance URL
     */
    const getRandomInstance = () => {
        return INVIDIOUS_INSTANCES[Math.floor(Math.random() * INVIDIOUS_INSTANCES.length)];
    };

    /**
     * Extracts the video ID from a YouTube URL
     * @param {string} url - The YouTube URL to process
     * @returns {string|null} The video ID if found, null otherwise
     */
    const getVideoIdFromURL = url => {
        const match = url.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
        return match ? match[1] : null;
    };

    // Main execution
    const videoId = getVideoIdFromURL(window.location.href);
    if (videoId) {
        const newUrl = `${getRandomInstance()}/watch?v=${videoId}`;
        window.location.replace(newUrl);
    }
})();
