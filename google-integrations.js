(() => {
  const config = window.toolHubGoogleConfig || {};
  const root = document.getElementById('google-consent-root');
  const modalRoot = document.getElementById('modal-root');
  const storageKey = 'tool-hub-google-consent-v1';
  const analyticsId = /^G-[A-Z0-9]+$/i.test(config.analyticsMeasurementId || '') ? config.analyticsMeasurementId : '';
  const publisherId = /^ca-pub-\d+$/.test(config.adsensePublisherId || '') ? config.adsensePublisherId : '';
  const adSlotId = /^\d+$/.test(config.adsenseSlotId || '') ? config.adsenseSlotId : '';
  const hasAnalytics = Boolean(analyticsId);
  const hasAds = Boolean(publisherId && adSlotId);
  let consent = readConsent();
  let analyticsLoaded = false;
  let adsLoaded = false;

  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function gtag() { window.dataLayer.push(arguments); };
  window.gtag('consent', 'default', {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: 'denied',
    functionality_storage: 'granted',
    security_storage: 'granted',
    wait_for_update: 500
  });

  document.querySelectorAll('[data-cookie-settings]').forEach((link) => link.addEventListener('click', (event) => {
    event.preventDefault();
    showPreferences();
  }));
  document.querySelectorAll('[data-google-info="privacy"]').forEach((link) => link.addEventListener('click', (event) => {
    event.preventDefault();
    showPrivacy();
  }));

  if (!consent && (hasAnalytics || hasAds)) showBanner();
  else if (consent) activateIntegrations();

  function readConsent() {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey));
      if (saved && typeof saved.analytics === 'boolean' && typeof saved.ads === 'boolean') return saved;
    } catch {
      return null;
    }
    return null;
  }

  function showBanner() {
    root.innerHTML = `
      <section class="consent-banner" aria-label="Optional cookie choices">
        <div class="consent-copy">
          <strong>Privacy choices</strong>
          <p>Optional Google Analytics and advertising tags are off unless you allow them. Your files are never uploaded.</p>
        </div>
        <div class="consent-actions">
          <button type="button" data-consent="settings">Settings</button>
          <button type="button" data-consent="reject">Reject optional</button>
          <button class="primary" type="button" data-consent="accept">Accept optional</button>
        </div>
      </section>`;
    root.querySelector('[data-consent="settings"]').addEventListener('click', showPreferences);
    root.querySelector('[data-consent="reject"]').addEventListener('click', () => saveConsent(false, false));
    root.querySelector('[data-consent="accept"]').addEventListener('click', () => saveConsent(true, true));
  }

  function showPreferences() {
    const analyticsChecked = Boolean(consent && consent.analytics && hasAnalytics);
    const adsChecked = Boolean(consent && consent.ads && hasAds);
    root.innerHTML = `
      <section class="consent-banner" role="dialog" aria-label="Privacy preferences">
        <div class="consent-copy">
          <strong>Privacy preferences</strong>
          <p>Choose which optional Google services may run. File processing remains on your device.</p>
          <div class="consent-options">
            <label><input id="analytics-consent" type="checkbox" ${analyticsChecked ? 'checked' : ''} ${hasAnalytics ? '' : 'disabled'}><span>Google Analytics<small>${hasAnalytics ? 'Helps us understand site usage.' : 'Inactive until a valid G- measurement ID is configured.'}</small></span></label>
            <label><input id="ads-consent" type="checkbox" ${adsChecked ? 'checked' : ''} ${hasAds ? '' : 'disabled'}><span>Google AdSense<small>${hasAds ? 'Allows advertising on this site.' : 'Inactive until valid publisher and ad-slot IDs are configured.'}</small></span></label>
          </div>
          <p>For visitors in the EEA, UK, or Switzerland, configure a Google-certified consent management platform before serving ads.</p>
        </div>
        <div class="consent-actions">
          <button type="button" data-consent="cancel">Cancel</button>
          <button type="button" data-consent="reject">Reject optional</button>
          <button class="primary" type="button" data-consent="save">Save choices</button>
        </div>
      </section>`;
    root.querySelector('[data-consent="cancel"]').addEventListener('click', restoreConsentView);
    root.querySelector('[data-consent="reject"]').addEventListener('click', () => saveConsent(false, false));
    root.querySelector('[data-consent="save"]').addEventListener('click', () => {
      saveConsent(Boolean(root.querySelector('#analytics-consent')?.checked), Boolean(root.querySelector('#ads-consent')?.checked));
    });
    root.querySelector('#analytics-consent')?.focus();
  }

  function showPrivacy() {
    root.innerHTML = `
      <section class="consent-banner" role="dialog" aria-label="Privacy policy">
        <div class="consent-copy">
          <strong>Privacy policy</strong>
          <p>Tool Hub processes document files in your browser and does not upload them to its own servers. PDF, DOCX, and HTML contents stay on your device.</p>
          <p>If configured and allowed in your privacy choices, Google Analytics may collect site usage data and Google AdSense may use cookies or similar technologies to serve and measure ads. Google-hosted libraries and fonts may also receive standard connection data when the page loads.</p>
          <p>You can change optional Google consent at any time using Cookie settings. For EEA, UK, and Switzerland advertising, this site must be connected to a Google-certified consent management platform before ads are served.</p>
        </div>
        <div class="consent-actions">
          <button type="button" data-privacy="close">Close</button>
          <button class="primary" type="button" data-privacy="settings">Cookie settings</button>
        </div>
      </section>`;
    root.querySelector('[data-privacy="close"]').addEventListener('click', restoreConsentView);
    root.querySelector('[data-privacy="settings"]').addEventListener('click', showPreferences);
  }

  function restoreConsentView() {
    root.replaceChildren();
    if (!consent && (hasAnalytics || hasAds)) showBanner();
  }

  function saveConsent(analytics, ads) {
    consent = { analytics: Boolean(analytics && hasAnalytics), ads: Boolean(ads && hasAds), savedAt: new Date().toISOString() };
    try {
      localStorage.setItem(storageKey, JSON.stringify(consent));
    } catch {
      consent = null;
    }
    window.location.reload();
  }

  function activateIntegrations() {
    const analyticsAllowed = Boolean(consent.analytics && hasAnalytics);
    const adsAllowed = Boolean(consent.ads && hasAds);
    window.gtag('consent', 'update', {
      analytics_storage: analyticsAllowed ? 'granted' : 'denied',
      ad_storage: adsAllowed ? 'granted' : 'denied',
      ad_user_data: adsAllowed ? 'granted' : 'denied',
      ad_personalization: adsAllowed ? 'granted' : 'denied'
    });
    if (analyticsAllowed) loadAnalytics();
    if (adsAllowed) loadAds();
  }

  function loadAnalytics() {
    if (analyticsLoaded) return;
    analyticsLoaded = true;
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(analyticsId)}`;
    script.onload = () => {
      window.gtag('js', new Date());
      window.gtag('config', analyticsId);
    };
    document.head.append(script);
  }

  function loadAds() {
    if (adsLoaded) return;
    adsLoaded = true;
    const placement = document.getElementById('ad-placement');
    const adUnit = document.getElementById('toolhub-ad-unit');
    if (!placement || !adUnit) return;
    adUnit.setAttribute('data-ad-client', publisherId);
    adUnit.setAttribute('data-ad-slot', adSlotId);
    placement.hidden = false;
    const script = document.createElement('script');
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(publisherId)}`;
    script.onload = () => {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    };
    document.head.append(script);
  }
})();
