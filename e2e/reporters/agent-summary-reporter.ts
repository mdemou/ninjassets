import type {
  FullConfig,
  FullResult,
  Location,
  Reporter,
  Suite,
  TestCase,
  TestError,
  TestResult,
} from '@playwright/test/reporter';

const SNIPPET_MAX_LINES = 12;
const SNIPPET_MAX_CHARS = 900;

function trimSnippet(snippet: string): string {
  const lines = snippet.trimEnd().split('\n');
  const head = lines.slice(0, SNIPPET_MAX_LINES).join('\n');
  const out = head.length > SNIPPET_MAX_CHARS ? head.slice(0, SNIPPET_MAX_CHARS) + '...' : head;
  return out.trimEnd();
}

function formatLocation(loc: Location | undefined): string | null {
  if (!loc?.file) return null;
  return `${loc.file}:${loc.line}`;
}

function assertionSiteFromStack(stack: string | undefined): string | null {
  if (!stack) return null;
  const m = stack.match(/at (.+?\.(?:spec|test)\.[cm]?tsx?):(\d+):\d+/);
  if (!m) return null;
  return `${m[1]}:${m[2]}`;
}

function mergeMessageAndStack(message: string, stack: string): string {
  const msg = message.trimEnd();
  const stk = stack.trimEnd();
  if (!stk) return msg;
  const extra = stk
    .split('\n')
    .map((l) => l.trimEnd())
    .filter(Boolean)
    .filter((line) => !msg.includes(line));
  if (extra.length === 0) return msg;
  return `${msg}\n\n${extra.join('\n')}`;
}

function snippetIfNotInMessage(snippet: string | undefined, message: string): string | null {
  if (!snippet?.trim()) return null;
  const trimmed = trimSnippet(snippet);
  const firstLine = trimmed.split('\n')[0]?.trim() ?? '';
  if (firstLine && message.includes(firstLine)) return null;
  return trimmed;
}

function formatFailureBody(error: TestError | undefined, fallback: string): string {
  const locLine = formatLocation(error?.location) ?? assertionSiteFromStack(error?.stack);
  const failedAt = locLine ? `Failed at: ${locLine}` : null;
  const msg = (error?.message ?? fallback).trimEnd();
  const snippet = snippetIfNotInMessage(error?.snippet, msg);
  const body = mergeMessageAndStack(msg, error?.stack ?? '');
  const parts: string[] = [];

  if (failedAt) parts.push(failedAt);
  if (snippet) parts.push(snippet);
  parts.push(body);

  return parts.filter(Boolean).join('\n\n');
}

export default class AgentSummaryReporter implements Reporter {
  private passed = 0;
  private failureOutput: string | null = null;

  printsToStdio(): boolean {
    return true;
  }

  private setFailureOutput(text: string) {
    if (!this.failureOutput) this.failureOutput = text.trimEnd();
  }

  onBegin(_config: FullConfig, _suite: Suite) {
    console.log('testing...');
  }

  onError(error: TestError) {
    if (this.failureOutput) return;
    this.setFailureOutput(formatFailureBody(error, 'Unknown error'));
  }

  onTestEnd(test: TestCase, result: TestResult) {
    if (this.failureOutput) return;
    if (result.status === 'passed') {
      this.passed += 1;
      return;
    }

    if (result.status === 'failed' || result.status === 'timedOut' || result.status === 'interrupted') {
      const fallback = result.status === 'timedOut' ? 'timed out' : result.status;
      const body = formatFailureBody(result.error, fallback);
      const header = `${test.location.file}:${test.location.line} > ${test.title}`;
      this.setFailureOutput(`${header}\n\n${body}`);
    }
  }

  onEnd(result: FullResult) {
    if (this.failureOutput) {
      console.log(this.failureOutput);
      return;
    }

    if (result.status === 'passed') {
      console.log(`PASS ${this.passed} tests`);
      return;
    }

    console.log(`FAIL run status: ${result.status}`);
  }
}
