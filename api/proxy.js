export default async (req, res) => {
  try {
    // 动态构建目标URL
    const target = new URL(
      req.headers['x-proxy-target'] || 'https://cdn.xcqcoo.top' // 从header读取代理目标
    );
    
    // 保留原始请求路径
    const originalPath = new URL(req.url, `http://${req.headers.host}`).pathname;
    target.pathname = originalPath;

    // 保留原始查询参数
    const searchParams = new URLSearchParams(req.query);
    target.search = searchParams.toString();

    // 发起代理请求
    const response = await fetch(target.toString(), {
      method: req.method,
      headers: {
        ...Object.fromEntries(
          Object.entries(req.headers)
            .filter(([k]) => !['host', 'x-proxy-target'].includes(k.toLowerCase()))
        ),
        host: target.host
      },
      redirect: 'manual',
      body: req.method !== 'GET' ? req.body : undefined
    });

    // 处理重定向
    if ([301, 302, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      return res.redirect(response.status, location.replace(target.origin, req.headers.host));
    }

    // 传递响应
    res.status(response.status);
    response.headers.forEach((value, key) => {
      if (!['content-length', 'connection'].includes(key.toLowerCase())) {
        res.setHeader(key, value);
      }
    });
    
    // 流式传输响应体
    response.body.pipe(res);

  } catch (error) {
    res.status(500).json({
      code: "PROXY_ERROR",
      message: error.message,
      path: req.url
    });
  }
};
