import { PassThrough } from 'stream';

// 白名单验证
const ALLOWED_PATHS = new Set(['npm', 'gh', 'wp', 'combine']);
const TARGET_DOMAIN = 'https://cdn.jsdelivr.net';

export default async (req, res) => {
  const path = req.query.p || '';
  const [prefix] = path.split('/');
  
  try {
    // ===== 安全验证 =====
    if (!ALLOWED_PATHS.has(prefix)) {
      return res.status(403).send('Invalid resource path');
    }

    // ===== 构建目标URL =====
    const target = new URL(path, TARGET_DOMAIN);
    target.search = new URL(req.url, 'http://n').search; // 保留原始查询参数

    // ===== 发起代理请求 =====
    const response = await fetch(target, {
      method: req.method,
      headers: {
        ...Object.fromEntries(
          Object.entries(req.headers)
            .filter(([k]) => !['host', 'cookie'].includes(k.toLowerCase()))
        ),
        host: target.hostname
      },
      redirect: 'manual',
      compress: false
    });

    // ===== 处理特殊响应 =====
    if (response.status === 302) {
      const location = response.headers.get('location');
      return res.redirect(302, location.replace(TARGET_DOMAIN, req.headers.host));
    }

    // ===== 设置响应头 =====
    res.status(response.status);
    ['content-type', 'cache-control', 'etag', 'last-modified'].forEach(header => {
      const value = response.headers.get(header);
      if (value) res.setHeader(header, value);
    });
    
    // 智能缓存策略
    if (path.includes('@')) {
      res.setHeader('Cache-Control', 'public, max-age=3600, immutable');
    } else {
      res.setHeader('Cache-Control', 'public, max-age=3600');
    }

    // ===== 流式传输 =====
    const passthrough = new PassThrough();
    response.body.pipe(passthrough).pipe(res);

  } catch (error) {
    res.status(500).json({
      code: "JSDELIVR_PROXY_FAIL",
      message: error.message,
      path: req.url
    });
  }
};
