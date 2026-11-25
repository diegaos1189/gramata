/**
 * Worker "Avísame cuando llegue" para Librería Grámmata.
 *
 * Dos rutas:
 *   POST /subscribe          -> guarda el correo de un visitante interesado en un producto agotado
 *   POST /webhook/inventory  -> recibido por Shopify cuando cambia el inventario; si el producto
 *                               volvió a tener stock y tiene suscriptores, les envía el correo y
 *                               limpia la lista.
 *
 * Variables de entorno necesarias (Settings -> Variables and Secrets en el Worker):
 *   SHOPIFY_STORE_DOMAIN   ej: libreria-grammata-online.myshopify.com
 *   SHOPIFY_ADMIN_TOKEN    token de una app personalizada con scopes read_products, write_products
 *   SHOPIFY_WEBHOOK_SECRET el "Client secret" de esa misma app (para verificar el webhook)
 *   RESEND_API_KEY         API key de resend.com
 *   RESEND_FROM_EMAIL      remitente verificado, ej: Librería Grámmata <avisos@libreriagrammata.com>
 *   ALLOWED_ORIGIN         ej: https://libreriagrammata.com
 */

const SHOPIFY_API_VERSION = '2026-10';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return corsResponse(env, new Response(null, { status: 204 }));
    }

    if (request.method === 'POST' && url.pathname === '/subscribe') {
      return corsResponse(env, await handleSubscribe(request, env));
    }

    if (request.method === 'POST' && url.pathname === '/webhook/inventory') {
      return handleInventoryWebhook(request, env);
    }

    return new Response('Not found', { status: 404 });
  },
};

function corsResponse(env, response) {
  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', env.ALLOWED_ORIGIN || '*');
  headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type');
  return new Response(response.body, { status: response.status, headers });
}

async function shopifyGraphql(env, query, variables) {
  const res = await fetch(`https://${env.SHOPIFY_STORE_DOMAIN}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': env.SHOPIFY_ADMIN_TOKEN,
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) {
    throw new Error('Shopify GraphQL error: ' + JSON.stringify(json.errors));
  }
  return json.data;
}

function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length < 255;
}

// ---------- /subscribe ----------

async function handleSubscribe(request, env) {
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ error: 'invalid_json' }, 400);
  }

  const { productId, email } = body;

  if (!productId || typeof productId !== 'string' || !productId.startsWith('gid://shopify/Product/')) {
    return json({ error: 'invalid_product' }, 400);
  }
  if (!isValidEmail(email)) {
    return json({ error: 'invalid_email' }, 400);
  }

  const data = await shopifyGraphql(
    env,
    `query GetSubscribers($id: ID!) {
      product(id: $id) {
        metafield(namespace: "custom", key: "restock_subscribers") { value }
      }
    }`,
    { id: productId }
  );

  let subscribers = [];
  const raw = data.product?.metafield?.value;
  if (raw) {
    try {
      subscribers = JSON.parse(raw);
    } catch (e) {
      subscribers = [];
    }
  }

  const normalized = email.trim().toLowerCase();
  if (!subscribers.map((s) => s.toLowerCase()).includes(normalized)) {
    subscribers.push(normalized);
  }

  await shopifyGraphql(
    env,
    `mutation SetSubscribers($metafields: [MetafieldsSetInput!]!) {
      metafieldsSet(metafields: $metafields) {
        userErrors { field message }
      }
    }`,
    {
      metafields: [
        {
          ownerId: productId,
          namespace: 'custom',
          key: 'restock_subscribers',
          type: 'list.single_line_text_field',
          value: JSON.stringify(subscribers),
        },
      ],
    }
  );

  return json({ ok: true });
}

// ---------- /webhook/inventory ----------

async function verifyShopifyHmac(request, secret) {
  const hmacHeader = request.headers.get('X-Shopify-Hmac-Sha256');
  if (!hmacHeader) return { valid: false, rawBody: null };

  const rawBody = await request.text();
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody));
  const computed = btoa(String.fromCharCode(...new Uint8Array(signature)));

  return { valid: computed === hmacHeader, rawBody };
}

async function handleInventoryWebhook(request, env) {
  const { valid, rawBody } = await verifyShopifyHmac(request, env.SHOPIFY_WEBHOOK_SECRET);
  if (!valid) {
    return new Response('Invalid signature', { status: 401 });
  }

  const payload = JSON.parse(rawBody);
  const inventoryItemId = `gid://shopify/InventoryItem/${payload.inventory_item_id}`;

  const data = await shopifyGraphql(
    env,
    `query GetProductFromInventoryItem($id: ID!) {
      inventoryItem(id: $id) {
        variant {
          inventoryQuantity
          product {
            id
            title
            handle
            onlineStoreUrl
            featuredImage { url }
            priceRangeV2 { minVariantPrice { amount currencyCode } }
            metafield(namespace: "custom", key: "restock_subscribers") { value }
          }
        }
      }
    }`,
    { id: inventoryItemId }
  );

  const variant = data.inventoryItem?.variant;
  if (!variant || variant.inventoryQuantity <= 0) {
    return new Response('ok', { status: 200 });
  }

  const product = variant.product;
  const raw = product.metafield?.value;
  let subscribers = [];
  if (raw) {
    try {
      subscribers = JSON.parse(raw);
    } catch (e) {
      subscribers = [];
    }
  }

  if (subscribers.length === 0) {
    return new Response('ok', { status: 200 });
  }

  const productUrl = product.onlineStoreUrl || `https://${env.STORE_PUBLIC_DOMAIN || env.SHOPIFY_STORE_DOMAIN}/products/${product.handle}`;
  const price = product.priceRangeV2?.minVariantPrice;

  await Promise.all(
    subscribers.map((email) => sendRestockEmail(env, email, product, productUrl, price))
  );

  await shopifyGraphql(
    env,
    `mutation ClearSubscribers($metafields: [MetafieldsSetInput!]!) {
      metafieldsSet(metafields: $metafields) {
        userErrors { field message }
      }
    }`,
    {
      metafields: [
        {
          ownerId: product.id,
          namespace: 'custom',
          key: 'restock_subscribers',
          type: 'list.single_line_text_field',
          value: JSON.stringify([]),
        },
      ],
    }
  );

  return new Response('ok', { status: 200 });
}

async function sendRestockEmail(env, toEmail, product, productUrl, price) {
  const priceLabel = price ? `$${Number(price.amount).toLocaleString('es-CO')}` : '';

  const html = `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <h2>¡Ya llegó!</h2>
      <p><strong>${product.title}</strong> ya está disponible de nuevo.</p>
      ${product.featuredImage ? `<img src="${product.featuredImage.url}" alt="${product.title}" style="max-width: 200px; display: block; margin: 16px 0;">` : ''}
      ${priceLabel ? `<p style="font-size: 20px; font-weight: bold;">${priceLabel}</p>` : ''}
      <p><a href="${productUrl}" style="display: inline-block; background: #7a1f2b; color: #fff; padding: 12px 20px; text-decoration: none; border-radius: 6px;">Comprar ahora</a></p>
      <p style="font-size: 12px; color: #777; margin-top: 24px;">Recibiste este correo porque pediste que te avisáramos cuando este libro volviera a tener existencias en Librería Grámmata.</p>
    </div>
  `;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: env.RESEND_FROM_EMAIL,
      to: toEmail,
      subject: `Ya llegó: ${product.title}`,
      html,
    }),
  });

  if (!res.ok) {
    console.error('Resend error for', toEmail, await res.text());
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
