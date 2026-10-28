import { readFile } from 'node:fs/promises';

export async function checkUpstream({ github, context, baseCommit, verification = false }) {
  const snapshot = await readFile(new URL('../src/data/upstreamSnapshot.ts', import.meta.url), 'utf8');
  const repository = snapshot.match(/repository:\s*'https:\/\/github\.com\/([^']+)'/)?.[1];
  const pinned = snapshot.match(/commit:\s*'([a-f0-9]{40})'/)?.[1];
  if (!repository || !pinned) throw new Error('Cannot read the upstream repository and commit from upstreamSnapshot.ts.');

  const [owner, repo] = repository.split('/');
  const upstream = { owner, repo };
  const { data: metadata } = await github.rest.repos.get(upstream);
  const { data: head } = await github.rest.repos.getCommit({ ...upstream, ref: metadata.default_branch });
  const base = baseCommit ?? pinned;
  const result = { repository, base, head: head.sha, verification };
  if (base === head.sha) return { ...result, status: 'up_to_date' };

  const marker = `<!-- x-upstream-monitor:${verification ? `verification:${context.runId}:` : ''}${head.sha} -->`;
  // REST issue lists returned stale results immediately after issue creation in the live E2E flow.
  let cursor = null;
  do {
    const { repository: { issues } } = await github.graphql(`
      query($owner: String!, $repo: String!, $cursor: String) {
        repository(owner: $owner, name: $repo) {
          issues(first: 100, after: $cursor, orderBy: {field: CREATED_AT, direction: DESC}) {
            nodes { number body url }
            pageInfo { hasNextPage endCursor }
          }
        }
      }
    `, { ...context.repo, cursor });
    const existing = issues.nodes.find((issue) => issue.body.includes(marker));
    if (existing) {
      return { ...result, status: 'already_notified', issue: existing.url, issueNumber: existing.number };
    }
    cursor = issues.pageInfo.hasNextPage ? issues.pageInfo.endCursor : null;
  } while (cursor);

  const { data: comparison } = await github.rest.repos.compareCommitsWithBasehead({
    ...upstream, basehead: `${base}...${head.sha}`, per_page: 100,
  });
  const compareUrl = `https://github.com/${repository}/compare/${base}...${head.sha}`;
  const commitLines = comparison.commits.slice(-10).map((commit) =>
    `- [${commit.sha.slice(0, 7)}](${commit.html_url}) ${commit.commit.message.split('\n')[0]}`);
  const fileLines = (comparison.files ?? []).slice(0, 30).map((file) =>
    `- \`${file.filename}\` (${file.status}, +${file.additions}/-${file.deletions})`);
  const body = [
    marker,
    verification ? '**验证通知：本次使用已有的上游历史提交。验证结束后会关闭此 Issue。**' : 'X 算法上游有新提交，请决定是否适配。',
    '',
    `- 对比基线：[${base.slice(0, 7)}](https://github.com/${repository}/commit/${base})`,
    `- 上游最新：[${head.sha.slice(0, 7)}](${head.html_url})`,
    `- [完整差异](${compareUrl})，比较状态：\`${comparison.status}\`，提交数：${comparison.total_commits}。`,
    '',
    '### 提交预览（最多 10 项）',
    ...commitLines,
    '',
    '### 文件预览（最多 30 项）',
    ...fileLines,
    '',
    '### 手动触发适配',
    '检查完整差异，判断候选来源、过滤、排序、权重和输出结构是否需要调整。',
    '需要适配时，将此 Issue 链接发给开发助手，并发送：',
    '',
    `> 按 X 上游提交 ${head.sha} 适配本项目。完成端到端测试并保存可重复的验证工件。`,
    '',
    '监控只创建提醒。它不修改代码，不触发适配，也不运行项目测试。',
    '同一上游提交只提醒一次。关闭此 Issue 后也不会重复创建。',
    `检查记录：${context.serverUrl}/${context.repo.owner}/${context.repo.repo}/actions/runs/${context.runId}`,
  ].join('\n');
  const { data: issue } = await github.rest.issues.create({
    ...context.repo,
    title: `${verification ? '[验证] ' : ''}X 上游更新：${head.sha.slice(0, 7)}`,
    body,
    assignees: [context.repo.owner],
  });
  return { ...result, status: 'created', issue: issue.html_url, issueNumber: issue.number };
}
