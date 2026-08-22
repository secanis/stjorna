import { test as base, expect, Page } from '@playwright/test';
import path from 'path';
import {
  AIPayload,
  A11yNode,
  bboxFromDiffPng,
  findAttachment,
  truncateA11yByBbox,
  writePayload,
} from './ai-payload';

const AI_OUTPUT_DIR = path.join(process.cwd(), 'ai-failed-tests');
const A11Y_MAX_NODES = 500;

interface CDPAxNode {
  nodeId: string;
  ignored?: boolean;
  role?: { value: string };
  name?: { value?: string };
  description?: { value?: string };
  value?: { value?: string | number };
  properties?: Array<{ name: string; value: { value?: unknown } }>;
  childIds?: string[];
  parentId?: string;
}

interface CDPAxTree {
  nodes: CDPAxNode[];
}

async function captureA11yTree(page: Page): Promise<A11yNode | null> {
  try {
    const cdp = await page.context().newCDPSession(page);
    const result = await cdp.send('Accessibility.getFullAXTree');
    const tree = result as unknown as CDPAxTree;
    return buildA11yTree(tree.nodes);
  } catch {
    return null;
  }
}

function buildA11yTree(nodes: CDPAxNode[]): A11yNode | null {
  if (!nodes || nodes.length === 0) return null;
  const byId = new Map<string, CDPAxNode>();
  for (const n of nodes) byId.set(n.nodeId, n);
  const root = nodes.find((n) => !n.parentId) ?? nodes[0];
  return convertNode(root, byId);
}

function convertNode(node: CDPAxNode, byId: Map<string, CDPAxNode>): A11yNode {
  const out: A11yNode = { role: node.role?.value ?? 'unknown' };
  if (node.name?.value) out.name = node.name.value;
  if (node.description?.value) out.description = node.description.value;
  if (node.value?.value !== undefined) out.value = node.value.value;
  const childIds = node.childIds ?? [];
  if (childIds.length > 0) {
    out.children = [];
    for (const id of childIds) {
      const child = byId.get(id);
      if (child) out.children.push(convertNode(child, byId));
    }
    if (out.children.length === 0) delete out.children;
  }
  return out;
}

function countA11yNodes(root: A11yNode | null): number {
  if (!root) return 0;
  let n = 1;
  const stack: A11yNode[] = [root];
  while (stack.length > 0) {
    const node = stack.pop()!;
    if (Array.isArray(node.children)) {
      for (const c of node.children) {
        n += 1;
        stack.push(c);
      }
    }
  }
  return n;
}

export const test = base.extend({
  page: async ({ page }, use, testInfo) => {
    await use(page);

    if (testInfo.status === testInfo.expectedStatus) return;

    const actualPath = findAttachment(testInfo.attachments, '-actual.png');
    const expectedPath = findAttachment(testInfo.attachments, '-expected.png');
    const diffPath = findAttachment(testInfo.attachments, '-diff.png');

    let diffBbox: ReturnType<typeof bboxFromDiffPng> = null;
    let a11ySubtree: AIPayload['a11ySubtree'] = null;
    let a11yFullNodeCount = 0;
    let a11ySubtreeNodeCount = 0;

    try {
      diffBbox = bboxFromDiffPng(diffPath);
    } catch {
      diffBbox = null;
    }

    try {
      const a11yTree = await captureA11yTree(page);
      if (a11yTree) {
        a11yFullNodeCount = countA11yNodes(a11yTree);
        const { subtree, kept } = truncateA11yByBbox(a11yTree, diffBbox, A11Y_MAX_NODES);
        a11ySubtree = subtree;
        a11ySubtreeNodeCount = kept;
      } else {
        console.warn('[AI Hook] a11y tree empty');
      }
    } catch (err) {
      console.warn(`[AI Hook] a11y snapshot failed: ${(err as Error).message}`);
      a11ySubtree = null;
    }

    const payload: AIPayload = {
      testId: testInfo.testId,
      testName: testInfo.title,
      testFile: testInfo.file,
      errorMessage: testInfo.error?.message ?? 'Visual regression failed',
      stackTrace: testInfo.error?.stack ?? '',
      url: page.url(),
      viewport: page.viewportSize(),
      timestamp: new Date().toISOString(),
      attachments: { actualPath, expectedPath, diffPath },
      diffBbox,
      a11ySubtree,
      a11yFullNodeCount,
      a11ySubtreeNodeCount,
    };

    const payloadPath = writePayload(payload, AI_OUTPUT_DIR);
    console.log(`\n[AI Hook] Context payload generated at: ${payloadPath}`);
  },
});

export { expect };
