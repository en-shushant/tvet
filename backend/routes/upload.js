const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { authenticate } = require('../middleware/auth');
const crypto = require('crypto');
const path = require('path');

const ACCOUNT_ID = process.env.CF_ACCOUNT_ID;
const BUCKET     = process.env.R2_BUCKET || 'tvettrack';
const PUBLIC_URL = process.env.R2_PUBLIC_URL; // e.g. https://pub-xxx.r2.dev or custom domain

const ALLOWED = /^(image\/(jpeg|png|gif|webp|bmp|tiff)|application\/pdf)$/;

module.exports = async function uploadRoutes(fastify) {
  fastify.register(require('@fastify/multipart'), {
    limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
  });

  fastify.addHook('preHandler', authenticate);

  fastify.post('/', async (request, reply) => {
    if (!ACCOUNT_ID || !process.env.R2_ACCESS_KEY_ID) {
      return reply.code(503).send({ error: 'R2 not configured — add CF_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_PUBLIC_URL to .env' });
    }

    const data = await request.file();
    if (!data) return reply.code(400).send({ error: 'No file uploaded' });

    const mime = data.mimetype;
    if (!ALLOWED.test(mime)) {
      return reply.code(400).send({ error: 'Only images and PDFs are allowed' });
    }

    const buf  = await data.toBuffer();
    const ext  = path.extname(data.filename).toLowerCase() || (mime === 'application/pdf' ? '.pdf' : '.bin');
    const key  = `uploads/${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`;

    const s3 = new S3Client({
      region: 'auto',
      endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId:     process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      },
    });

    await s3.send(new PutObjectCommand({
      Bucket:      BUCKET,
      Key:         key,
      Body:        buf,
      ContentType: mime,
    }));

    const url = `${(PUBLIC_URL || '').replace(/\/$/, '')}/${key}`;
    return { url, key };
  });
};
