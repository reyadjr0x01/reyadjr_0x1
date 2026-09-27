const { put, head } = require('@vercel/blob');

function slugify(page) {
  return String(page || 'unknown')
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, '-')
    .slice(0, 80);
}

function blobPath(slug) {
  return `likes/${slug}.json`;
}

async function readData(slug) {
  try {
    const info = await head(blobPath(slug));
    const response = await fetch(info.url, { cache: 'no-store' });
    if (!response.ok) throw new Error('blob fetch failed');
    const data = await response.json();
    return {
      count: typeof data.count === 'number' ? data.count : 0,
      names: Array.isArray(data.names) ? data.names : [],
      voters: Array.isArray(data.voters) ? data.voters : [],
    };
  } catch (e) {
    return { count: 0, names: [], voters: [] };
  }
}

async function writeData(slug, data) {
  await put(blobPath(slug), JSON.stringify(data), {
    access: 'public',
    contentType: 'application/json',
    allowOverwrite: true,
  });
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method === 'GET') {
    const page = req.query && req.query.page;
    const slug = slugify(page);
    const data = await readData(slug);
    res.status(200).json({ count: data.count, names: data.names });
    return;
  }

  if (req.method === 'POST') {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (e) { body = {}; }
    }
    body = body || {};

    const slug = slugify(body.page);
    const name = String(body.name || '').trim().slice(0, 40);
    const visitorId = String(body.visitorId || '').trim().slice(0, 100);

    if (!name || !visitorId) {
      res.status(400).json({ error: 'name and visitorId are required' });
      return;
    }

    const data = await readData(slug);

    if (data.voters.includes(visitorId)) {
      res.status(200).json({ count: data.count, names: data.names, alreadyLiked: true });
      return;
    }

    data.voters.push(visitorId);
    data.names.push(name);
    data.count += 1;

    await writeData(slug, data);

    res.status(200).json({ count: data.count, names: data.names, alreadyLiked: false });
    return;
  }

  res.status(405).json({ error: 'Method not allowed' });
};
