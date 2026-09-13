import test from 'node:test';
import assert from 'node:assert/strict';
import { injectPublicPageMetadata, matchPublicPage } from './public-page.mjs';

test('matches only canonical public creation and profile routes', () => {
  assert.deepEqual(matchPublicPage('/c/glider-clock'), { kind: 'creation', identifier: 'glider-clock' });
  assert.deepEqual(matchPublicPage('/u/ada'), { kind: 'profile', identifier: 'ada' });
  assert.equal(matchPublicPage('/studio'), null);
});

test('social metadata is escaped and replaces only the public page title', () => {
  const html = injectPublicPageMetadata('<html><head><title>Life</title></head></html>', { title: '<Draft>', description: 'Safe & public', url: 'https://test/c/a' });
  assert.match(html, /&lt;Draft&gt;/);
  assert.match(html, /Safe &amp; public/);
  assert.match(html, /property="og:title"/);
});
