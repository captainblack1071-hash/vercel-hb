var https = require('https');

var SECRET_KEY = 'avci_hb_2026';

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  var key = req.query.key;
  if (key !== SECRET_KEY) {
    return res.status(403).json({ error: 'unauthorized' });
  }

  var action = req.query.action || 'fetch';

  if (action === 'ip') {
    var ipRes = await httpGet('https://api.ipify.org?format=json', {});
    return res.status(200).end(ipRes.body);
  }

  if (action === 'fetch') {
    var sku = req.query.sku;
    var slug = req.query.slug;
    if (!sku || !slug) {
      return res.status(400).json({ error: 'sku ve slug gerekli' });
    }
    var result = await fetchHB(sku, slug);
    return res.status(result.error ? 502 : 200).json(result);
  }

  if (action === 'batch') {
    var body = req.body;
    if (!Array.isArray(body) || body.length === 0) {
      return res.status(400).json({ error: 'body array olmali' });
    }
    if (body.length > 10) {
      body = body.slice(0, 10);
    }

    var results = await Promise.all(body.map(function(item) {
      var t0 = Date.now();
      return fetchHB(item.sku, item.slug).then(function(r) {
        r.id = item.id || null;
        r.sku = item.sku;
        r.duration_ms = Date.now() - t0;
        return r;
      });
    }));

    return res.status(200).json({ results: results });
  }

  return res.status(400).json({ error: 'gecersiz action' });
};

function httpGet(url, headers) {
  return new Promise(function(resolve, reject) {
    var parsed = new URL(url);
    var opts = {
      hostname: parsed.hostname,
      port: 443,
      path: parsed.pathname + parsed.search,
      method: 'GET',
      headers: headers
    };
    var r = https.request(opts, function(resp) {
      var chunks = [];
      resp.on('data', function(c) { chunks.push(c); });
      resp.on('end', function() {
        var body = Buffer.concat(chunks).toString();
        resolve({ statusCode: resp.statusCode, body: body });
      });
    });
    r.on('error', reject);
    r.end();
  });
}

function fetchHB(sku, slug) {
  var apiUrl = 'https://www.hepsiburada.com/api/v1/productDetail/sku/' + sku + '?name=' + slug;
  var referer = 'https://www.hepsiburada.com/' + slug + '-p-' + sku;

  var headers = {
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
  };

  return httpGet(apiUrl, headers).then(function(result) {
    if (result.statusCode !== 200) {
      return { error: 'HTTP ' + result.statusCode, status_code: result.statusCode, raw_preview: result.body.substring(0, 200) };
    }

    var data;
    try {
      data = JSON.parse(result.body);
    } catch (e) {
      return { error: 'JSON parse hatasi', raw_length: result.body.length, raw_preview: result.body.substring(0, 200) };
    }

    if (data.statusCode && data.statusCode !== 200) {
      return { error: 'HTTP ' + data.statusCode, status_code: data.statusCode };
    }

    if (data.redirection && data.redirection.url && (!data.data || !data.data.product)) {
      return { redirect: true, redirect_url: data.redirection.url, statusCode: data.statusCode || 0 };
    }
    if (data.redirectUrl && (!data.data || !data.data.product)) {
      return { redirect: true, redirect_url: data.redirectUrl, statusCode: data.statusCode || 0 };
    }

    var product = (data.data && data.data.product) ? data.data.product : null;
    var inStock = product && product.stockInformation && product.stockInformation.isInStock === true;

    if (product && !inStock) {
      return { success: true, in_stock: false, product_name: product.name || '', data: data };
    }

    return { success: true, in_stock: true, data: data };

  }).catch(function(e) {
    return { error: e.message || 'fetch hatasi' };
  });
}
