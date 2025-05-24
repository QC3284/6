const { createProxyMiddleware } = require('http-proxy-middleware');

const mimeTypes = {
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.png': 'image/png'
};

module.exports = (req, res) => {
  const { user, repo, branch, path } = req.query;
  
  // 检查必要参数是否存在
  if (!user || !repo || !branch || !path) {
    return res.status(400).send('Missing parameters');
  }

  // 代理中间件
  createProxyMiddleware({
    target: 'https://raw.githubusercontent.com',
    changeOrigin: true,
    pathRewrite: {
      '^/api/gh-proxy': `/${user}/${repo}/${branch}/${path}`
    },
    onProxyRes: (proxyRes) => {
      const ext = path.split('.').pop();
      proxyRes.headers['content-type'] = mimeTypes[`.${ext}`] || 'text/plain';
      proxyRes.headers['cache-control'] = 'public, max-age=3600';
    }
  })(req, res);
};
