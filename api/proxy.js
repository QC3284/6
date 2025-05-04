import { Transform } from 'stream';
import zlib from 'zlib';

// 配置常量
const DEFAULT_TARGET = 'https://cdn.xcqcoo.top';
const ALLOWED_ENCODINGS = new Set(['gzip', 'deflate', 'br']);
const CACHE_TTL = process.env.NODE_ENV === 'production' ? 3600 : 0;

export default async (req, res) => {
  try {
    // ===== 1. 构建目标URL =====
    const targetUrl = new URL(req.query.url || DEFAULT_TARGET);
    const path = req.url.replace(/^\/api\/proxy/, '');
    targetUrl.pathname = path + targetUrl.pathname;

    // ===== 2. 清理请求头 =====
    const headers = {
      ...Object.fromEntries(
        Object.entries(req.headers)
          .filter(([k]) => !['host', 'connection', 'cf-'].includes(k.toLowerCase()))
      ),
      host: targetUrl.host,
      'accept-encoding': 'gzip, deflate, br'
    };

    // ===== 3. 发起代理请求 =====
    const response = await fetch(targetUrl.toString(), {
      method: req.method,
      headers,
      body: req.method !== 'GET' ? req.body : undefined,
      compress: false,
      redirect: 'manual'
    });

    // ===== 4. 处理响应头 =====
    const contentEncoding = (response.headers.get('content-encoding') || '')
      .toLowerCase()
      .split(',')[0]
      .trim();

    if (contentEncoding && !ALLOWED_ENCODINGS.has(contentEncoding)) {
      throw new Error(`Unsupported encoding: ${contentEncoding}`);
    }

    // 设置响应头
    res.status(response.status);
    response.headers.forEach((value, key) => {
      if (!['content-length', 'content-encoding'].includes(key.toLowerCase())) {
        res.setHeader(key, value);
      }
    });

    if (contentEncoding) {
      res.setHeader('Content-Encoding', contentEncoding);
    }

    res.setHeader('Cache-Control', `public, max-age=${CACHE_TTL}, s-maxage=${CACHE_TTL}`);
    res.setHeader('Vary', 'Accept-Encoding');

    // ===== 5. 智能编码转换 =====
    const acceptEncoding = req.headers['accept-encoding'] || '';
    const needConvert = contentEncoding === 'br' && !acceptEncoding.includes('br');

    const pipeline = response.body
      .on('error', err => {
        console.error('Upstream error:', err);
        if (!res.headersSent) res.status(502).end();
      });

    if (needConvert) {
      // Brotli -> Gzip 转换
      res.setHeader('Content-Encoding', 'gzip');
      pipeline
        .pipe(zlib.createBrotliDecompress())
        .pipe(zlib.createGzip());
    }

    // ===== 6. 安全流传输 =====
    const safeStream = new Transform({
      transform(chunk, _, callback) {
        this.push(chunk);
        callback();
      },
      flush(callback) {
        callback();
      }
    });

    pipeline
      .pipe(safeStream)
      .pipe(res);

  } catch (error) {
    console.error('Global proxy error:', error);
    if (!res.headersSent) {
      res.status(500).json({
        error: "PROXY_ERROR",
        message: error.message,
        code: error.code || 'UNKNOWN'
      });
    }
  }
};
