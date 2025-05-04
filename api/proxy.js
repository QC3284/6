import { PassThrough } from 'stream';

export default async (req, res) => {
  try {
    // ===== 1. 构建目标URL =====
    const targetUrl = new URL(req.query.url || 'https://cdn.xcqcoo.top');

    // ===== 2. 流式请求初始化 =====
    const abortController = new AbortController();
    req.on('close', () => abortController.abort());

    const response = await fetch(targetUrl, {
      method: req.method,
      headers: { ...req.headers, host: targetUrl.host },
      body: req.method !== 'GET' ? req.body : undefined,
      signal: abortController.signal,
      compress: false
    });

    // ===== 3. 头信息优化 =====
    res.status(response.status);
    ['content-type', 'cache-control', 'vary'].forEach(header => {
      const value = response.headers.get(header);
      if (value) res.setHeader(header, value);
    });

    // ===== 4. 零内存管道传输 =====
    const passthrough = new PassThrough();
    response.body.pipe(passthrough).pipe(res);

    // ===== 5. 内存监控 =====
    let peakMemory = process.memoryUsage().rss;
    const monitor = setInterval(() => {
      peakMemory = Math.max(peakMemory, process.memoryUsage().rss);
      if (peakMemory > 900 * 1024 * 1024) { // 预留 124MB 安全空间
        abortController.abort();
        clearInterval(monitor);
      }
    }, 100);

  } catch (error) {
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    }
  }
};
