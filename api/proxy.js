export default async (req, res) => {
  const targetUrl = new URL(req.query.url || 'https://cdn.xcqcoo.top');
  
  // 动态处理子路径
  const path = req.url.replace('/api/proxy', '');
  targetUrl.pathname = path;

  // 请求目标内容
  const response = await fetch(targetUrl.toString(), {
    method: req.method,
    headers: {
      ...req.headers,
      host: targetUrl.host, // 重置 Host 头
      referer: targetUrl.origin,
    },
    body: req.method !== 'GET' ? req.body : undefined,
  });

  // 传递关键响应头
  res.setHeader('Content-Type', response.headers.get('Content-Type'));
  res.setHeader('Cache-Control', 'public, s-maxage=3600'); // 启用 CDN 缓存

  // 流式传输响应内容
  const data = await response.arrayBuffer();
  res.send(Buffer.from(data));
};
