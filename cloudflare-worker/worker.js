const OWNER = "hck717";
const REPO = "restaurant-clock";
const PATH = "data.json";
const API = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${PATH}`;

const GH_HEADERS = {
  "Accept": "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  "User-Agent": "restaurant-clock-worker",
};

function toBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

export default {
  async fetch(request, env) {
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    const headers = { ...GH_HEADERS, Authorization: `Bearer ${env.GITHUB_TOKEN}` };

    if (request.method === "GET") {
      const res = await fetch(API, { headers });
      if (res.status === 404) {
        return new Response("{}", { headers: { ...cors, "Content-Type": "application/json" } });
      }
      if (!res.ok) {
        return new Response("Error reading GitHub", { status: 500, headers: cors });
      }
      const file = await res.json();
      const data = atob(file.content.replace(/\n/g, ""));
      return new Response(data, { headers: { ...cors, "Content-Type": "application/json" } });
    }

    if (request.method === "POST") {
      let body;
      try {
        body = await request.json();
      } catch {
        return new Response("Invalid JSON", { status: 400, headers: cors });
      }

      // Read current file to get SHA for conflict-resolving update
      let sha;
      const current = await fetch(API, { headers });
      if (current.ok) {
        const file = await current.json();
        sha = file.sha;
      }

      const payload = {
        message: "update data",
        content: toBase64(JSON.stringify(body, null, 2)),
      };
      if (sha) payload.sha = sha;

      const putRes = await fetch(API, {
        method: "PUT",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!putRes.ok) {
        const err = await putRes.text();
        return new Response("Write failed: " + err, { status: 500, headers: cors });
      }
      return new Response("OK", { status: 200, headers: cors });
    }

    return new Response("Not found", { status: 404, headers: cors });
  },
};