/**
 * Instagram Graph API — carousel publisher.
 *
 * Requires the image URLs to be PUBLICLY reachable by Meta's servers.
 * Hosting strategy options:
 *
 *   A) GitHub Pages branch of this repo (recommended): push outputs to a
 *      `gh-pages` branch, then use raw.githubusercontent.com URLs.
 *   B) Any signed-URL bucket (R2, Supabase Storage, S3).
 *
 * For now this module accepts already-public URLs as input. The orchestrator
 * (main.js) is responsible for hosting and providing them.
 *
 * Required env vars at publish time:
 *   - META_LONG_LIVED_TOKEN
 *   - IG_BUSINESS_ACCOUNT_ID
 *
 * Set DRY_RUN=true to short-circuit before any network call.
 */

const GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v22.0';

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

async function withRetry(fn, { attempts = 3, baseDelayMs = 800 } = {}) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const status = err?.status ?? 0;
      const retriable = status === 429 || (status >= 500 && status < 600) || status === 0;
      if (!retriable || i === attempts - 1) throw err;
      const delay = baseDelayMs * Math.pow(2, i);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

async function graphPost(url, body, token) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, access_token: token })
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(`Graph API error ${res.status}: ${JSON.stringify(json)}`);
    err.status = res.status;
    err.body = json;
    throw err;
  }
  return json;
}

async function createCarouselChild({ igId, base, token, imageUrl }) {
  return withRetry(() =>
    graphPost(`${base}/${igId}/media`, {
      image_url: imageUrl,
      is_carousel_item: true
    }, token)
  );
}

async function createCarouselContainer({ igId, base, token, childIds, caption }) {
  return withRetry(() =>
    graphPost(`${base}/${igId}/media`, {
      media_type: 'CAROUSEL',
      children: childIds.join(','),
      caption
    }, token)
  );
}

async function publishContainer({ igId, base, token, containerId }) {
  return withRetry(() =>
    graphPost(`${base}/${igId}/media_publish`, {
      creation_id: containerId
    }, token)
  );
}

export async function publishCarousel({ imageUrls, caption, dryRun = false }) {
  if (!Array.isArray(imageUrls) || imageUrls.length < 2 || imageUrls.length > 10) {
    throw new Error(`publishCarousel: imageUrls must be an array of 2-10 public URLs (got ${imageUrls?.length}).`);
  }

  if (dryRun) {
    return {
      dry_run: true,
      would_publish: { imageUrls, caption },
      note: 'DRY_RUN=true → no network call made.'
    };
  }

  const token = requireEnv('META_LONG_LIVED_TOKEN');
  const igId = requireEnv('IG_BUSINESS_ACCOUNT_ID');
  const base = `https://graph.facebook.com/${GRAPH_VERSION}`;

  const childIds = [];
  for (const url of imageUrls) {
    const { id } = await createCarouselChild({ igId, base, token, imageUrl: url });
    childIds.push(id);
  }

  const { id: containerId } = await createCarouselContainer({ igId, base, token, childIds, caption });
  const published = await publishContainer({ igId, base, token, containerId });

  return {
    dry_run: false,
    instagram_post_id: published.id,
    container_id: containerId,
    child_ids: childIds
  };
}
