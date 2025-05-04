export default async (req, res) => {
  try {
    // 确保路径参数正确传递
    const target = new URL(
      req.query.url || 'https://cdn.xcqcoo.top' + req.url.replace('/api/proxy', '')
    );

    // 调试日志
    console.log('Proxying:', target.toString());

    const response = await fetch(target, {
      method: req.method,
      headers: {
        ...req.headers,
        host: target.host
      },
      redirect: 'manual',
      body: req.method !== 'GET' ? req.body : undefined
    });

    // 处理重定向
    if ([301, 302, 307, 308].includes(response.status)) {
      res.redirect(response.status, response.headers.get('location'));
      return;
    }

    // 传递响应
    res.status(response.status);
    response.headers.forEach((v, k) => res.setHeader(k, v));
    response.body.pipe(res);

  } catch (error) {
    console.error('Proxy Error:', error);
    res.status(500).json({ 
      code: "PROXY_FAILURE",
      message: error.message
    });
  }
};
