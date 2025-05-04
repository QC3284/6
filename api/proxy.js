export default async (req, res) => {
  try {
    const targetUrl = new URL(req.query.url || 'https://cdn.xcqcoo.top');
    const path = req.url.replace('/api/proxy', '');
    targetUrl.pathname = path;

    // 发起请求时禁止自动解压
    const response = await fetch(targetUrl.toString(), {
      method: req.method,
      headers: {
        // 过滤客户端压缩要求
        ...Object.fromEntries(
          Object.entries(req.headers).filter(([k]) => !k.toLowerCase().startsWith('accept-encoding'))
        ),
        host: targetUrl.host,
        'accept-encoding': 'gzip, deflate, br' // 明确声明支持所有压缩格式
      },
      compress: false, // 关键：禁止 Node.js 自动解压
      body: req.method !== 'GET' ? req.body : undefined
    });

    // 传递关键编码头
    const contentEncoding = response.headers.get('content-encoding');
    if (contentEncoding) {
      res.setHeader('Content-Encoding', contentEncoding);
    }

    // 传递内容类型
    res.setHeader('Content-Type', response.headers.get('content-type') || 'text/plain');

    // 流式传输原始二进制数据
    response.body.pipe(res);

  } catch (error) {
    res.status(500).send(`Proxy Error: ${error.message}`);
  }
};
