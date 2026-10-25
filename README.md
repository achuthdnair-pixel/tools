# Tool Hub

Browser-based document utilities for Malayalam DOCX cleanup, PDF/image conversion, and HTML merging.

## Google Analytics and AdSense

Google integrations are disabled until valid account IDs are configured in `index.html`:

```js
window.toolHubGoogleConfig = {
	analyticsMeasurementId: 'G-XXXXXXXXXX',
	adsensePublisherId: 'ca-pub-XXXXXXXXXXXXXXXX',
	adsenseSlotId: '1234567890'
};
```

Use your own GA4 measurement ID, AdSense publisher ID, and ad-unit slot ID. The site loads Analytics and shows the ad placement only after the visitor allows the corresponding optional service in Cookie settings. Blank or invalid IDs keep the integrations inactive.

Before serving ads, finish the AdSense site review and publish its required disclosures and `ads.txt` entry using your real publisher ID. For visitors in the EEA, UK, or Switzerland, connect a Google-certified consent management platform; the built-in preferences are not a certified CMP and do not by themselves guarantee legal compliance.