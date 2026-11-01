/** Return an image file ID only for supported Google Drive URL formats. */
export function extractDriveId(url) {
  if (!url || typeof url !== 'string') return null;
  let parsed;
  try {
    parsed = new URL(url.trim());
  } catch {
    return null;
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) return null;

  let id;
  if (parsed.hostname === 'drive.google.com') {
    id = parsed.pathname.match(/^\/(?:file\/)?d\/([^/]+)/)?.[1]
      || parsed.searchParams.get('id');
  } else if (parsed.hostname === 'lh3.googleusercontent.com') {
    id = parsed.pathname.match(/^\/d\/([^/=]+)/)?.[1];
  }
  return id && /^[A-Za-z0-9_-]+$/.test(id) ? id : null;
}

export function driveEmbedVariants(url) {
  if (!url || typeof url !== 'string') return [];
  const raw = url.trim();
  if (!raw) return [];
  const id = extractDriveId(raw);
  if (!id) return [raw];
  return [
    `https://lh3.googleusercontent.com/d/${id}=w2400`,
    `https://drive.google.com/thumbnail?id=${id}&sz=w2400`,
    `https://drive.google.com/uc?export=view&id=${id}`,
  ];
}

export function driveDirectUrl(url) {
  return driveEmbedVariants(url)[0] || null;
}
