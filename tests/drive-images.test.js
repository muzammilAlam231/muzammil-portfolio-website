import test from 'node:test';
import assert from 'node:assert/strict';
import { extractDriveId, driveEmbedVariants, driveDirectUrl } from '../src/js/drive-images.js';

test('keeps external images with id query parameters unchanged', () => {
  const url = 'https://images.example.com/photo?id=123&width=800';
  assert.equal(extractDriveId(url), null);
  assert.deepEqual(driveEmbedVariants(url), [url]);
  assert.equal(driveDirectUrl(url), url);
});

test('extracts Drive file IDs without query strings or fragments', () => {
  for (const url of [
    'https://drive.google.com/file/d/FILE_ID-123/view?usp=sharing',
    'https://drive.google.com/file/d/FILE_ID-123?usp=sharing',
    'https://drive.google.com/d/FILE_ID-123#preview',
    'https://drive.google.com/open?id=FILE_ID-123',
    'https://drive.google.com/uc?export=view&id=FILE_ID-123',
    'https://lh3.googleusercontent.com/d/FILE_ID-123=w2400',
  ]) {
    assert.equal(extractDriveId(url), 'FILE_ID-123', url);
  }
});

test('generates the existing three fallback URLs for Drive images', () => {
  assert.deepEqual(driveEmbedVariants('https://drive.google.com/file/d/abc/view'), [
    'https://lh3.googleusercontent.com/d/abc=w2400',
    'https://drive.google.com/thumbnail?id=abc&sz=w2400',
    'https://drive.google.com/uc?export=view&id=abc',
  ]);
});

test('does not reinterpret unrelated hosts or local project images', () => {
  for (const url of ['https://example.com/file/d/abc',
    'https://drive.google.com.example.com/open?id=abc', '/projects/demo.png']) {
    assert.equal(extractDriveId(url), null);
    assert.deepEqual(driveEmbedVariants(url), [url]);
  }
});

test('handles empty and invalid inputs without throwing', () => {
  for (const value of [null, undefined, 3, '', '   ']) {
    assert.deepEqual(driveEmbedVariants(value), []);
    assert.equal(driveDirectUrl(value), null);
  }
  assert.equal(extractDriveId('not a URL'), null);
  assert.equal(extractDriveId('https://drive.google.com/open?id=a%2Fb'), null);
});
