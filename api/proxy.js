export default async (req, res) => {
  try {
    const targetUrl = new URL(req.query.url || 'https://cdn.xcqcoo.top');
    const path = req.url.replace('/api/proxy', '');
    targetUrl.pathname = path;

    // 发起代理请求
    const response = await fetch(targetUrl.toString(), {
      method: req.method,
      headers: {
        ...req.headers,
        host: targetUrl.host,
        // 移除可能冲突的压缩头
        'accept-encoding': 'gzip, deflate, br'
      },
      body: req.method !== 'GET' ? req.body : undefined
    });

    // 关键头信息传递
    const contentType = response.headers.get('content-type');
    const contentEncoding = response.headers.get('content-encoding');
    
    // 设置响应头
    res.setHeader('Content-Type', contentType || 'text/plain; charset=utf-8');
    if (contentEncoding) res.setHeader('Content-Encoding', contentEncoding);
    res.setHeader('Cache-Control', 'public, max-age=3600');

    // 二进制安全传输
    if (contentType?.startsWith('text/') || contentType?.includes('json')) {
      // 文本类内容
      const text = await response.text();
      res.send(text);
    } else {
      // 二进制类内容（图片/字体等）
      const buffer = await response.arrayBuffer();
      res.send(Buffer.from(buffer));
    }
    
  } catch (error) {
    res.status(500).send(`
      <h1>代理错误</h1>
      <pre>${error.stack}</pre>
    `);
  }
};
