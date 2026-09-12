import { randomBytes } from 'node:crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function bootstrapDocument(nonce: string): string {
    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="dark">
  <title>Opening tool · Lernumi</title>
  <style nonce="${nonce}">
    :root{font-family:ui-sans-serif,system-ui,sans-serif;color:#d7d7d7;background:#181818}
    body{min-height:100vh;margin:0;display:grid;place-items:center}
    main{display:flex;align-items:center;gap:12px;font-size:14px}
    i{width:16px;height:16px;border:2px solid #555;border-top-color:#3aa99f;border-radius:50%;animation:spin .8s linear infinite}
    p{margin:0}small{display:block;color:#999;margin-top:5px}
    @keyframes spin{to{transform:rotate(360deg)}}
  </style>
</head>
<body>
  <main><i aria-hidden="true"></i><div><p id="message">Opening Lernumi tool…</p><small id="detail">Establishing a secure runtime session.</small></div></main>
  <script nonce="${nonce}">
    (async()=>{
      const fragment=new URLSearchParams(location.hash.slice(1));
      const token=fragment.get('lernumi_token');
      const api=fragment.get('lernumi_api');
      const message=document.getElementById('message');
      const detail=document.getElementById('detail');
      if(!token||api!=='v1'){
        message.textContent='This launch link is incomplete.';
        detail.textContent='Return to Lernumi and open the tool again.';
        return;
      }
      try{
        const response=await fetch('/api/tool/v1/runtime-auth',{
          method:'POST',
          headers:{Authorization:'Bearer '+token},
          credentials:'include',
          cache:'no-store'
        });
        const payload=await response.json().catch(()=>null);
        if(!response.ok||!payload?.runtimePath)throw new Error(payload?.error?.message||'Runtime authorization failed');
        const target=new URL(payload.runtimePath,location.origin);
        target.hash=fragment.toString();
        location.replace(target);
      }catch(error){
        message.textContent='The tool could not be opened.';
        detail.textContent=error instanceof Error?error.message:'Return to Lernumi and try again.';
      }
    })();
  </script>
</body>
</html>`;
}

export async function GET(): Promise<Response> {
    const nonce = randomBytes(18).toString('base64');
    return new Response(bootstrapDocument(nonce), {
        headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'private, no-store',
            'Content-Security-Policy': [
                "default-src 'none'",
                `script-src 'nonce-${nonce}'`,
                `style-src 'nonce-${nonce}'`,
                "connect-src 'self'",
                "img-src 'none'",
                "frame-ancestors 'none'",
                "base-uri 'none'",
                "form-action 'none'",
            ].join('; '),
            'Referrer-Policy': 'no-referrer',
            'X-Content-Type-Options': 'nosniff',
        },
    });
}
