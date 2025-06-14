import { createMiddleware } from '@vercel/edge';

export default createMiddleware(async (req) => {
  const url = new URL(req.url);
  const path = url.pathname;

  // 代理路由映射
  const proxyMap = {
    '/gh/': 'https://raw.githubusercontent.com',
    '/npm/': 'https://unpkg.com',
    '/esm/': 'https://esm.run',
    '/wp/plugins/': 'https://plugins.svn.wordpress.org',
    '/wp/themes/': 'https://themes.svn.wordpress.org',
    '/jsd/': 'https://cdn.jsdelivr.net'
  };

  // 特殊重定向处理
  const specialCases = {
    '/jsd/esm/': 'https://esm.run'
  };

  // 查找匹配的路由前缀
  const matchedPrefix = Object.keys(proxyMap).find(prefix => path.startsWith(prefix)) ||
                      Object.keys(specialCases).find(prefix => path.startsWith(prefix));

  if (!matchedPrefix) return;

  // 处理特殊重定向
  if (specialCases[matchedPrefix]) {
    const target = specialCases[matchedPrefix] + path.slice(matchedPrefix.length - 1);
    return new Response(null, {
      status: 308,
      headers: { 
        Location: target,
        'Cache-Control': 'public, max-age=31536000'
      }
    });
  }

  // 构建目标URL
  let target = proxyMap[matchedPrefix];
  const restPath = path.slice(matchedPrefix.length);

  // 特殊路径转换逻辑
  if (matchedPrefix === '/wp/themes/') {
    const parts = restPath.split('/');
    if (parts.length >= 3) {
      const [theme, typeOrVer, ...rest] = parts;
      let versionPath = '';
      
      if (typeOrVer === 'trunk') {
        versionPath = 'trunk';
      } else if (typeOrVer === 'tags') {
        versionPath = `tags/${rest.shift() || 'latest'}`;
      } else {
        versionPath = `tags/${typeOrVer}`;
      }
      
      target += `/${theme}/${versionPath}/${rest.join('/')}`;
    } else {
      return new Response('Invalid theme path', { status: 400 });
    }
  } 
  // WordPress 插件处理
  else if (matchedPrefix === '/wp/plugins/') {
    const parts = restPath.split('/');
    if (parts.length >= 3) {
      const [plugin, type, version, ...rest] = parts;
      if (type === 'tags' && version) {
        target += `/${plugin}/tags/${version}/${rest.join('/')}`;
      } else if (type === 'trunk') {
        target += `/${plugin}/trunk/${version ? version + '/' : ''}${rest.join('/')}`;
      } else {
        return new Response('Invalid plugin path', { status: 400 });
      }
    } else {
      return new Response('Invalid plugin path', { status: 400 });
    }
  }
  // 通用代理处理
  else {
    target += restPath;
  }

  // 设置缓存头
  const cacheControl = matchedPrefix === '/gh/' ? 'public, max-age=86400' : 
                     matchedPrefix === '/wp/' ? 'public, max-age=86400' : 
                     'public, max-age=31536000';

  // 发起代理请求
  const proxyReq = new Request(target, {
    headers: req.headers,
    method: req.method,
    body: req.body,
    redirect: 'follow'
  });

  const res = await fetch(proxyReq);

  // 添加CORS和缓存头
  const headers = new Headers(res.headers);
  headers.set('Cache-Control', cacheControl);
  headers.set('Access-Control-Allow-Origin', '*');
  headers.delete('content-security-policy');

  return new Response(res.body, {
    status: res.status,
    headers: headers
  });
});

export const config = {
  matcher: [
    '/gh/:path*',
    '/npm/:path*',
    '/esm/:path*',
    '/wp/:path*',
    '/jsd/:path*'
  ]
};