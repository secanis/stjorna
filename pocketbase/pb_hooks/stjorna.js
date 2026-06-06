// STJÓRNA PocketBase Hooks
// This file is loaded by PocketBase on startup

const S3_BUCKET = process.env.S3_BUCKET || '';
const S3_REGION = process.env.S3_REGION || '';
const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID || '';
const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY || '';

const s3Enabled = S3_BUCKET !== '' && S3_REGION !== '';

// Log hook initialization
console.log('STJÓRNA hooks loaded (S3: ' + s3Enabled + ')');

// Helper to get tenant from auth record
function getTenantId(authRecord) {
    return authRecord && authRecord.tenant ? authRecord.tenant : '';
}

// Webhook dispatcher
function dispatchWebhooks(tenantId, eventType, payload) {
    if (!tenantId || !pb) return;

    pb.collection('webhooks').getFullList({
        filter: 'tenant = "' + tenantId + '" && active = true'
    }).then(webhooks => {
        webhooks.forEach(webhook => {
            if (webhook.events && webhook.events.includes(eventType)) {
                deliverWebhook(webhook.url, webhook.secret, eventType, payload);
            }
        });
    }).catch(err => {
        console.log('Webhook dispatch error:', err);
    });
}

function deliverWebhook(url, secret, eventType, payload) {
    if (!url) return;

    const body = JSON.stringify(payload);
    const headers = {
        'Content-Type': 'application/json',
        'X-STJORNA-Event': eventType
    };

    if (secret) {
        const crypto = require('crypto');
        const sig = crypto.createHmac('sha256', secret).update(body).digest('hex');
        headers['X-STJORNA-Signature'] = 'sha256=' + sig;
    }

    fetch(url, {
        method: 'POST',
        headers: headers,
        body: body
    }).then(res => {
        if (res.status >= 400) {
            console.log('Webhook error:', res.status);
        }
    }).catch(err => {
        console.log('Webhook delivery failed:', err);
    });
}

// On record create hooks
pb.hook('categories', 'create', (e) => {
    const tenantId = getTenantId(e.auth);
    if (!tenantId) return;

    dispatchWebhooks(tenantId, 'category.created', {
        id: e.record.id,
        tenant: tenantId,
        event: 'category.created',
        timestamp: new Date().toISOString(),
        data: e.record
    });
});

pb.hook('products', 'create', (e) => {
    const tenantId = getTenantId(e.auth);
    if (!tenantId) return;

    dispatchWebhooks(tenantId, 'product.created', {
        id: e.record.id,
        tenant: tenantId,
        event: 'product.created',
        timestamp: new Date().toISOString(),
        data: e.record
    });
});

pb.hook('media', 'create', (e) => {
    const tenantId = getTenantId(e.auth);
    if (!tenantId) return;

    dispatchWebhooks(tenantId, 'media.uploaded', {
        id: e.record.id,
        tenant: tenantId,
        event: 'media.uploaded',
        timestamp: new Date().toISOString(),
        data: e.record
    });
});

// S3 Presign routes (if enabled)
if (s3Enabled) {
    console.log('STJÓRNA S3 hooks enabled');

    // Presign upload URL
    pocketbase.router().post('/api/collections/media/presign', async (c) => {
        const auth = c.auth();
        if (!auth) {
            return c.json(401, { error: 'unauthorized' });
        }

        const tenantId = auth.tenant;
        if (!tenantId) {
            return c.json(403, { error: 'tenant required' });
        }

        const body = await c.req().json();
        if (!body.filename || !body.mime_type) {
            return c.json(400, { error: 'filename and mime_type required' });
        }

        const crypto = require('crypto');
        const mediaId = body.media_id || crypto.randomBytes(8).toString('hex');
        const s3Key = 'tenants/' + tenantId + '/uploads/original/' + mediaId + '/' + body.filename;

        // For actual S3 presigning, you would use the AWS SDK
        // For now, return a mock response - actual implementation requires
        // integrating with AWS SDK for JavaScript in the Node.js environment
        return c.json(200, {
            upload_url: 'https://' + S3_BUCKET + '.s3.' + S3_REGION + '.amazonaws.com/' + s3Key,
            fields: { 'Content-Type': body.mime_type },
            media_id: mediaId,
            expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
            s3_key: s3Key,
            note: 'S3 presign requires additional setup with AWS SDK'
        });
    });

    // Confirm upload
    pocketbase.router().post('/api/collections/media/confirm-upload', async (c) => {
        const auth = c.auth();
        if (!auth) {
            return c.json(401, { error: 'unauthorized' });
        }

        const tenantId = auth.tenant;
        if (!tenantId) {
            return c.json(403, { error: 'tenant required' });
        }

        const body = await c.req().json();
        if (!body.s3_key || !body.filename) {
            return c.json(400, { error: 's3_key and filename required' });
        }

        const s3Url = 'https://' + S3_BUCKET + '.s3.' + S3_REGION + '.amazonaws.com/' + body.s3_key;

        const record = new Record(pb.collection('media'));
        record.set('tenant', tenantId);
        record.set('filename', body.filename);
        record.set('original_name', body.original_name || body.filename);
        record.set('mime_type', body.mime_type || 'image/jpeg');
        record.set('size', body.size || 0);
        record.set('width', body.width || 0);
        record.set('height', body.height || 0);
        record.set('s3_key', body.s3_key);
        record.set('s3_url', s3Url);
        record.set('thumbnail_url', '');
        record.set('createdUser', auth.id);

        await pb.save(record);

        return c.json(200, record);
    });

    // Presign download
    pocketbase.router().post('/api/collections/media/presign-download', async (c) => {
        const auth = c.auth();
        if (!auth) {
            return c.json(401, { error: 'unauthorized' });
        }

        const body = await c.req().json();
        if (!body.media_id) {
            return c.json(400, { error: 'media_id required' });
        }

        const expires = Math.min(Math.max(body.expires || 3600, 1), 3600);

        try {
            const record = await pb.collection('media').findOne(body.media_id);
            if (!record.s3_key) {
                return c.json(400, { error: 'no S3 key' });
            }

            const downloadUrl = 'https://' + S3_BUCKET + '.s3.' + S3_REGION + '.amazonaws.com/' + record.s3_key;
            const expiresAt = new Date(Date.now() + expires * 1000).toISOString();

            return c.json(200, {
                download_url: downloadUrl,
                expires_at: expiresAt
            });
        } catch (err) {
            return c.json(404, { error: 'media not found' });
        }
    });
}