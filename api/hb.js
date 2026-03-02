export const config = { runtime: 'edge' };

var SECRET_KEY = 'avci_hb_2026';
var CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*'
};

export default async function handler(request) {
  // OPTIONS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  var url = new URL(request.url);
  var key = url.searchParams.get('key');
  if (key !== SECRET_KEY) {
    return new Response('{"error":"unauthorized"}', { status: 403, headers: CORS_HEADERS });
  }

  var action = url.searchParams.get('action') || 'fetch';

  // IP kontrolu
  if (action === 'ip') {
    var resp = await fetch('https://api.ipify.org?format=json');
    var body = await resp.text();
    return new Response(body, { status: 200, headers: CORS_HEADERS });
  }

  // --- Tekli fetch ---
  if (action === 'fetch') {
    var sku = url.searchParams.get('sku');
    var slug = url.searchParams.get('slug');
    if (!sku || !slug) {
      return new Response('{"error":"sku ve slug gerekli"}', { status: 400, headers: CORS_HEADERS });
    }
    var result = await fetchHB(sku, slug);
    return new Response(JSON.stringify(result), { status: result.error ? 502 : 200, headers: CORS_HEADERS });
  }

  // --- Toplu fetch (POST body: [{sku, slug, id}, ...]) ---
  if (action === 'batch') {
    var body;
    try {
      body = await request.json();
    } catch (e) {
      return new Response('{"error":"gecersiz JSON body"}', { status: 400, headers: CORS_HEADERS });
    }
    if (!Array.isArray(body) || body.length === 0) {
      return new Response('{"error":"body array olmali"}', { status: 400, headers: CORS_HEADERS });
    }
    // Max 10 urun per batch - hepsi paralel
    if (body.length > 10) {
      body = body.slice(0, 10);
    }

    var results = await Promise.all(body.map(function(item) {
      var t0 = Date.now();
      return fetchHB(item.sku, item.slug).then(function(res) {
        res.id = item.id || null;
        res.sku = item.sku;
        res.duration_ms = Date.now() - t0;
        return res;
      });
    }));

    return new Response(JSON.stringify({ results: results }), { status: 200, headers: CORS_HEADERS });
  }

  return new Response('{"error":"gecersiz action"}', { status: 400, headers: CORS_HEADERS });
}

async function fetchHB(sku, slug) {
  var apiUrl = 'https://www.hepsiburada.com/api/v1/productDetail/sku/' + sku + '?name=' + slug;
  var referer = 'https://www.hepsiburada.com/' + slug + '-p-' + sku;

  try {
    var resp = await fetch(apiUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
        'Referer': referer,
        'Origin': 'https://www.hepsiburada.com',
        'sec-ch-ua': '"Google Chrome";v="131", "Chromium";v="131"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-origin'
      }
    });

    var text = await resp.text();

    if (resp.status !== 200) {
      return { error: 'HTTP ' + resp.status, status_code: resp.status };
    }

    var data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      return { error: 'JSON parse hatasi', raw_length: text.length };
    }

    // Redirect kontrolu
    if (data.redirection && data.redirection.url && (!data.data || !data.data.product)) {
      return { redirect: true, redirect_url: data.redirection.url, statusCode: data.statusCode || 0 };
    }
    if (data.redirectUrl && (!data.data || !data.data.product)) {
      return { redirect: true, redirect_url: data.redirectUrl, statusCode: data.statusCode || 0 };
    }

    // Stok kontrolu
    var product = (data.data && data.data.product) ? data.data.product : null;
    var inStock = product && product.stockInformation && product.stockInformation.isInStock === true;

    if (product && !inStock) {
      return {
        success: true,
        in_stock: false,
        product_name: product.name || '',
        data: data
      };
    }

    return { success: true, in_stock: true, data: data };

  } catch (e) {
    return { error: e.message || 'fetch hatasi' };
  }
}
