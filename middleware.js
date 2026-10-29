// Vercel Routing Middleware. A share link with a visitor's name (/p/<slug>/?n=<name>) goes to api/share.js, which serves the
// poster's share page with the name in its title and preview. It has to happen here: a vercel.json rewrite only runs after the
// static files, and /p/<slug>/index.html always exists. Every other request passes straight through.
export const config = { matcher: '/p/:path*', runtime: 'nodejs' };

export default function middleware(request) {
  const url = new URL(request.url), m = /^\/p\/([a-z0-9-]+)\/?$/.exec(url.pathname);
  if (!m || !url.searchParams.has('n')) return new Response(null, { headers: { 'x-middleware-next': '1' } });
  const to = new URL(`/api/share/?slug=${m[1]}&n=${encodeURIComponent(url.searchParams.get('n'))}`, url.origin);
  return new Response(null, { headers: { 'x-middleware-rewrite': to.toString() } });
}
