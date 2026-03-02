    1 +var https = require('https');                                                                                                                             
        2 +                                                                                                                                                          
        3 +var SECRET_KEY = 'avci_hb_2026';                                                                                                                          
        4 +                                                                                                                                                          
        5 +module.exports = async function handler(req, res) {                                                                                                       
        6 +  res.setHeader('Access-Control-Allow-Origin', '*');                                                                                                      
        7 +  res.setHeader('Content-Type', 'application/json');                                                                                                      
        8 +                                                                                                                                                          
        9 +  if (req.method === 'OPTIONS') {                                                                                                                         
       10 +    return res.status(204).end();                                                                                                                         
       11 +  }                                                                                                                                                       
       12 +                                                                                                                                                          
       13 +  var key = req.query.key;                                                                                                                                
       14 +  if (key !== SECRET_KEY) {                                                                                                                               
       15 +    return res.status(403).json({ error: 'unauthorized' });                                                                                               
       16 +  }                                                                                                                                                       
       17 +                                                                                                                                                          
       18 +  var action = req.query.action || 'fetch';                                                                                                               
       19 +                                                                                                                                                          
       20 +  // IP kontrolu                                                                                                                                          
       21 +  if (action === 'ip') {                                                                                                                                  
       22 +    var ipData = await httpGet('https://api.ipify.org?format=json', {});                                                                                  
       23 +    return res.status(200).end(ipData);                                                                                                                   
       24 +  }                                                                                                                                                       
       25 +                                                                                                                                                          
       26 +  // Tekli fetch                                                                                                                                          
       27 +  if (action === 'fetch') {                                                                                                                               
       28 +    var sku = req.query.sku;                                                                                                                              
       29 +    var slug = req.query.slug;                                                                                                                            
       30 +    if (!sku || !slug) {                                                                                                                                  
       31 +      return res.status(400).json({ error: 'sku ve slug gerekli' });                                                                                      
       32 +    }                                                                                                                                                     
       33 +    var result = await fetchHB(sku, slug);                                                                                                                
       34 +    return res.status(result.error ? 502 : 200).json(result);                                                                                             
       35 +  }                                                                                                                                                       
       36 +                                                                                                                                                          
       37 +  // Toplu fetch                                                                                                                                          
       38 +  if (action === 'batch') {                                                                                                                               
       39 +    var body = req.body;                                                                                                                                  
       40 +    if (!Array.isArray(body) || body.length === 0) {                                                                                                      
       41 +      return res.status(400).json({ error: 'body array olmali' });                                                                                        
       42 +    }                                                                                                                                                     
       43 +    if (body.length > 10) {                                                                                                                               
       44 +      body = body.slice(0, 10);                                                                                                                           
       45 +    }                                                                                                                                                     
       46 +                                                                                                                                                          
       47 +    var results = await Promise.all(body.map(function(item) {                                                                                             
       48 +      var t0 = Date.now();                                                                                                                                
       49 +      return fetchHB(item.sku, item.slug).then(function(r) {                                                                                              
       50 +        r.id = item.id || null;                                                                                                                           
       51 +        r.sku = item.sku;                                                                                                                                 
       52 +        r.duration_ms = Date.now() - t0;                                                                                                                  
       53 +        return r;                                                                                                                                         
       54 +      });                                                                                                                                                 
       55 +    }));                                                                                                                                                  
       56 +                                                                                                                                                          
       57 +    return res.status(200).json({ results: results });                                                                                                    
       58 +  }                                                                                                                                                       
       59 +                                                                                                                                                          
       60 +  return res.status(400).json({ error: 'gecersiz action' });                                                                                              
       61 +};                                                                                                                                                        
       62 +                                                                                                                                                          
       63 +function httpGet(url, headers) {                                                                                                                          
       64 +  return new Promise(function(resolve, reject) {                                                                                                          
       65 +    var parsed = new URL(url);                                                                                                                            
       66 +    var opts = {                                                                                                                                          
       67 +      hostname: parsed.hostname,                                                                                                                          
       68 +      port: 443,                                                                                                                                          
       69 +      path: parsed.pathname + parsed.search,                                                                                                              
       70 +      method: 'GET',                                                                                                                                      
       71 +      headers: headers                                                                                                                                    
       72 +    };                                                                                                                                                    
       73 +    var req = https.request(opts, function(resp) {                                                                                                        
       74 +      var chunks = [];                                                                                                                                    
       75 +      resp.on('data', function(c) { chunks.push(c); });                                                                                                   
       76 +      resp.on('end', function() { resolve(Buffer.concat(chunks).toString()); });                                                                          
       77 +    });                                                                                                                                                   
       78 +    req.on('error', reject);                                                                                                                              
       79 +    req.end();                                                                                                                                            
       80 +  });                                                                                                                                                     
       81 +}                                                                                                                                                         
       82 +                                                                                                                                                          
       83 +function fetchHB(sku, slug) {                                                                                                                             
       84 +  var apiUrl = 'https://www.hepsiburada.com/api/v1/productDetail/sku/' + sku + '?name=' + slug;                                                           
       85 +  var referer = 'https://www.hepsiburada.com/' + slug + '-p-' + sku;                                                                                      
       86 +                                                                                                                                                          
       87 +  var headers = {                                                                                                                                         
       88 +    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',                      
       89 +    'Accept': '*/*',                                                                                                                                      
       90 +    'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',                                                                                             
       91 +    'Referer': referer,                                                                                                                                   
       92 +    'Origin': 'https://www.hepsiburada.com',                                                                                                              
       93 +    'sec-ch-ua': '"Google Chrome";v="131", "Chromium";v="131"',                                                                                           
       94 +    'sec-ch-ua-mobile': '?0',                                                                                                                             
       95 +    'sec-ch-ua-platform': '"Windows"',                                                                                                                    
       96 +    'sec-fetch-dest': 'empty',                                                                                                                            
       97 +    'sec-fetch-mode': 'cors',                                                                                                                             
       98 +    'sec-fetch-site': 'same-origin'                                                                                                                       
       99 +  };                                                                                                                                                      
      100 +                                                                                                                                                          
      101 +  return httpGet(apiUrl, headers).then(function(text) {                                                                                                   
      102 +    var data;                                                                                                                                             
      103 +    try {                                                                                                                                                 
      104 +      data = JSON.parse(text);                                                                                                                            
      105 +    } catch (e) {                                                                                                                                         
      106 +      return { error: 'JSON parse hatasi', raw_length: text.length };                                                                                     
      107 +    }                                                                                                                                                     
      108 +                                                                                                                                                          
      109 +    if (data.statusCode && data.statusCode !== 200) {                                                                                                     
      110 +      return { error: 'HTTP ' + data.statusCode, status_code: data.statusCode };                                                                          
      111 +    }                                                                                                                                                     
      112 +                                                                                                                                                          
      113 +    if (data.redirection && data.redirection.url && (!data.data || !data.data.product)) {                                                                 
      114 +      return { redirect: true, redirect_url: data.redirection.url, statusCode: data.statusCode || 0 };                                                    
      115 +    }                                                                                                                                                     
      116 +    if (data.redirectUrl && (!data.data || !data.data.product)) {                                                                                         
      117 +      return { redirect: true, redirect_url: data.redirectUrl, statusCode: data.statusCode || 0 };                                                        
      118 +    }                                                                                                                                                     
      119 +                                                                                                                                                          
      120 +    var product = (data.data && data.data.product) ? data.data.product : null;                                                                            
      121 +    var inStock = product && product.stockInformation && product.stockInformation.isInStock === true;                                                     
      122 +                                                                                                                                                          
      123 +    if (product && !inStock) {                                                                                                                            
      124 +      return { success: true, in_stock: false, product_name: product.name || '', data: data };                                                            
      125 +    }                                                                                                                                                     
      126 +                                                                                                                                                          
      127 +    return { success: true, in_stock: true, data: data };                                                                                                 
      128 +                                                                                                                                                          
      129 +  }).catch(function(e) {                                                                                                                                  
      130 +    return { error: e.message || 'fetch hatasi' };                                                                                                        
      131 +  });                                                                                                                                                     
      132 +} 
