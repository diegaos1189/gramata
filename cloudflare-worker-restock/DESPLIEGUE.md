# Desplegar "Avísame cuando llegue"

Sigue estos pasos en orden. Ninguno requiere instalar nada en tu computador.

## 1. Crear la app personalizada en Shopify (para el token de acceso)

1. Shopify Admin → **Configuración → Apps y canales de ventas** → **Desarrollar apps** → **Crear una app**.
2. Nombre: `Webhook Avisame` (o el que prefieras).
3. Pestaña **Configuración de API Admin** → **Configurar**. Activa estos scopes:
   - `read_products`
   - `write_products`
4. Guarda, luego pestaña **Credenciales de API** → **Instalar app**.
5. Copia el **Token de acceso de API Admin** (empieza con `shpat_`) — solo se muestra una vez. Guárdalo en un lugar seguro.
6. En esa misma pestaña, copia el **Client secret** (lo necesitas para verificar el webhook más adelante).

## 2. Crear cuenta en Resend (para enviar los correos)

1. Ve a [resend.com](https://resend.com) y crea una cuenta gratis (hasta 3.000 correos/mes).
2. Agrega tu dominio (`libreriagrammata.com`) en **Domains** y sigue las instrucciones para verificarlo (agregar unos registros DNS — si no manejas el DNS tú mismo, puede que necesites ayuda de quien lo administre).
3. Mientras verificas el dominio, puedes probar con el dominio de prueba que Resend te da.
4. Ve a **API Keys** → crea una nueva → cópiala.

## 3. Desplegar el Worker en Cloudflare

1. Ve a [dash.cloudflare.com](https://dash.cloudflare.com) y crea una cuenta gratis si no tienes.
2. **Workers y Pages** → **Crear** → **Crear Worker**.
3. Ponle un nombre, por ejemplo `grammata-restock`.
4. Una vez creado, entra a **Editar código** (Quick Edit / Edit code).
5. Borra todo el código de ejemplo y pega el contenido completo de `worker.js` (está en esta misma carpeta).
6. Haz clic en **Guardar y desplegar** (Deploy).
7. Copia la URL que te da, algo como `https://grammata-restock.tuusuario.workers.dev` — esa es la URL del webhook.

## 4. Configurar las variables de entorno del Worker

En el Worker → **Settings → Variables and Secrets** → agrega (todas como "Secret" menos las que digan URL):

| Nombre | Valor |
|---|---|
| `SHOPIFY_STORE_DOMAIN` | `libreria-grammata-online.myshopify.com` (confirmar el dominio exacto `.myshopify.com` en Configuración → General) |
| `SHOPIFY_ADMIN_TOKEN` | el token `shpat_...` del paso 1 |
| `SHOPIFY_WEBHOOK_SECRET` | el Client secret del paso 1 |
| `RESEND_API_KEY` | la API key de Resend |
| `RESEND_FROM_EMAIL` | ej: `Librería Grámmata <avisos@libreriagrammata.com>` |
| `ALLOWED_ORIGIN` | `https://libreriagrammata.com` |

Guarda y vuelve a desplegar si te lo pide.

## 5. Avísame cuando termines estos pasos

Cuando tengas la URL del Worker (paso 3.7), compártela aquí. Con eso:
- Actualizo la configuración del tema (`restock_webhook_url`) con la URL real.
- Registro el webhook de inventario en Shopify apuntando a `<tu-url>/webhook/inventory`.

## 6. Probar

1. En un producto agotado de la tienda, llena el formulario "Avísame cuando llegue" con tu propio correo.
2. En el Admin de Shopify, sube el inventario de ese producto a 1 o más.
3. En menos de un minuto deberías recibir el correo de aviso.

Si algo falla, en Cloudflare → tu Worker → **Logs** puedes ver los errores en tiempo real.
