#!/usr/bin/env node
/**
 * 生成 data/stats.json —— 页面用的 GitHub 数据快照。
 *
 * 由 .github/workflows/update-stats.yml 定时调用（用仓库自带的 GITHUB_TOKEN，
 * 不受匿名 API 60 次/小时的限额影响），也支持本地手动执行：
 *
 *   GITHUB_TOKEN=xxx node scripts/update-stats.mjs
 *   gh auth token | node scripts/update-stats.mjs   # 本地调试
 *
 * 页面优先读取这份静态快照；拿不到时再退回 GitHub 实时 API；
 * 再拿不到就使用 HTML 里内嵌的兜底数据。
 */

const USERNAME = process.env.GITHUB_USERNAME || 'rootphantomer';
const API = 'https://api.github.com';
const OUT_DIR = new URL('../data/', import.meta.url);
const OUT_FILE = new URL('../data/stats.json', import.meta.url);

const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '';
const headers = {
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  'User-Agent': 'rootphantomer-site-stats',
};
if (token) headers.Authorization = `Bearer ${token}`;

async function get(path) {
  const res = await fetch(`${API}${path}`, { headers });
  if (!res.ok) {
    throw new Error(`GET ${path} -> ${res.status} ${res.statusText}`);
  }
  return res.json();
}

function pickRepo(r) {
  return {
    name: r.name,
    fullName: r.full_name,
    description: r.description || '',
    language: r.language || '',
    stars: r.stargazers_count || 0,
    forks: r.forks_count || 0,
    homepage: r.homepage || '',
    url: r.html_url,
    isFork: !!r.fork,
    topics: r.topics || [],
    updatedAt: r.updated_at,
  };
}

async function main() {
  const profile = await get(`/users/${USERNAME}`);

  // 分页拉全部仓库（每页 100，最多 10 页）
  const all = [];
  for (let page = 1; page <= 10; page += 1) {
    const batch = await get(`/users/${USERNAME}/repos?per_page=100&page=${page}&sort=updated`);
    if (!Array.isArray(batch) || batch.length === 0) break;
    all.push(...batch);
    if (batch.length < 100) break;
    await new Promise((r) => setTimeout(r, 1000)); // 避免触发 secondary rate limit
  }

  const repos = all.map(pickRepo);
  const totals = repos.reduce(
    (acc, r) => ({
      stars: acc.stars + r.stars,
      forks: acc.forks + r.forks,
    }),
    { stars: 0, forks: 0 },
  );

  const payload = {
    generatedAt: new Date().toISOString(),
    profile: {
      login: profile.login,
      name: profile.name || profile.login,
      avatarUrl: profile.avatar_url,
      bio: profile.bio || '',
      publicRepos: profile.public_repos,
      followers: profile.followers,
      following: profile.following,
      createdAt: profile.created_at,
    },
    totals,
    repos,
  };

  const fs = await import('node:fs/promises');
  await fs.mkdir(OUT_DIR, { recursive: true });
  await fs.writeFile(OUT_FILE, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

  console.log(
    `✓ data/stats.json 已更新：${repos.length} 个仓库 / ${payload.totals.stars}★ / ` +
      `${payload.profile.followers} followers`,
  );
}

main().catch((err) => {
  console.error(`✗ 生成失败：${err.message}`);
  process.exit(1);
});
