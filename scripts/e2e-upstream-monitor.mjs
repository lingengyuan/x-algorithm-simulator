import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { checkUpstream } from './monitor-upstream.mjs';

export async function verifyNotifications({ github, context }) {
  const report = {
    status: 'running',
    startedAt: new Date().toISOString(),
    run: `${context.serverUrl}/${context.repo.owner}/${context.repo.repo}/actions/runs/${context.runId}`,
    commit: context.sha,
    checks: [],
  };
  let issueNumber;
  try {
    const live = await checkUpstream({ github, context });
    report.production = live;
    report.checks.push({ name: 'production check completed', status: 'passed' });

    const aligned = await checkUpstream({ github, context, baseCommit: live.head, verification: true });
    assert.equal(aligned.status, 'up_to_date');
    assert.equal(aligned.issueNumber, undefined);
    report.checks.push({ name: 'aligned upstream creates no notification', status: 'passed' });

    const { data: head } = await github.rest.repos.getCommit({
      owner: live.repository.split('/')[0], repo: live.repository.split('/')[1], ref: live.head,
    });
    const options = { github, context, baseCommit: head.parents[0].sha, verification: true };
    const notification = await checkUpstream(options);
    issueNumber = notification.issueNumber;
    assert.ok(issueNumber);
    report.notification = notification;
    const { data: issue } = await github.rest.issues.get({ ...context.repo, issue_number: issueNumber });
    assert.equal(issue.user.login, 'github-actions[bot]');
    assert.ok(issue.assignees.some((assignee) => assignee.login === context.repo.owner));
    assert.ok(issue.body.includes(`/compare/${options.baseCommit}...${live.head}`));
    assert.ok(issue.body.includes(`按 X 上游提交 ${live.head} 适配本项目`));
    report.checks.push({ name: 'real upstream comparison and assigned notification issue', status: 'passed' });

    const repeated = await checkUpstream(options);
    assert.equal(repeated.status, 'already_notified');
    assert.equal(repeated.issueNumber, issueNumber);
    report.checks.push({ name: 'repeat check does not create another issue', status: 'passed' });

    await github.rest.issues.update({ ...context.repo, issue_number: issueNumber, state: 'closed', state_reason: 'completed' });
    const afterClose = await checkUpstream(options);
    assert.equal(afterClose.status, 'already_notified');
    assert.equal(afterClose.issueNumber, issueNumber);
    report.checks.push({ name: 'closed notification remains deduplicated', status: 'passed' });
    report.status = 'passed';
    return report;
  } catch (error) {
    report.status = 'failed';
    report.error = error.message;
    throw error;
  } finally {
    try {
      if (issueNumber) {
        await github.rest.issues.update({ ...context.repo, issue_number: issueNumber, state: 'closed', state_reason: 'completed' });
      }
    } finally {
      report.completedAt = new Date().toISOString();
      const directory = new URL('../artifacts/upstream-monitor/', import.meta.url);
      await mkdir(directory, { recursive: true });
      await writeFile(new URL('report.json', directory), `${JSON.stringify(report, null, 2)}\n`);
    }
  }
}
