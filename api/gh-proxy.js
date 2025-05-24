// 导入所需模块
import { createProxyMiddleware } from 'http-proxy-middleware';

// MIME 类型映射表
const mimeTypes = {
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.json': 'application/json'
};

export default (req, res) => {
  // 从路径中提取参数
  const match = req.url.match(/\/gh\/([^/]+)\/([^/]+)@([^/]+)\/(.+)/);
  if (!match) {
    return res.status(400).send('Invalid URL format');
  }

  const [, user, repo, branch, path] = match;
  const ext = path.split('.').pop()?.toLowerCase();

  // 创建代理中间件
  createProxyMiddleware({
    target: 'https://raw.githubusercontent.com',
    changeOrigin: true,
    pathRewrite: {
      '^/api/gh-proxy': `/${user}/${repo}/${branch}/${path}`
    },
    onProxyRes: (proxyRes) => {
      // 动态设置 Content-Type
      const contentType = mimeTypes[`.${ext}`] || 'text/plain';
      proxyRes.headers['content-type'] = contentType;

      // 强制覆盖安全头
      proxyRes.headers['x-content-type-options'] = 'nosniff';
      proxyRes.headers['access-control-allow-origin'] = '*';
      
      // 智能缓存策略
      const cacheAge = branch === 'main' ? 3600 : 36000;
      proxyRes.headers['cache-control'] = `public, max-age=${cacheAge}`;
    }
  })(req, res);
};
