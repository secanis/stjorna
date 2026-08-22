import { PNG } from 'pngjs';
import fs from 'fs';
import path from 'path';

export interface Bbox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface A11yNode {
  role: string;
  name?: string;
  value?: string | number | boolean;
  description?: string;
  children?: A11yNode[];
  [key: string]: unknown;
}

export interface AIAttachments {
  actualPath: string | null;
  expectedPath: string | null;
  diffPath: string | null;
}

export interface AIPayload {
  testId: string;
  testName: string;
  testFile: string;
  errorMessage: string;
  stackTrace: string;
  url: string;
  viewport: { width: number; height: number } | null;
  timestamp: string;
  attachments: AIAttachments;
  diffBbox: Bbox | null;
  a11ySubtree: A11yNode | null;
  a11yFullNodeCount: number;
  a11ySubtreeNodeCount: number;
}

const DIFF_PIXEL_THRESHOLD = 8;

export function readPng(filePath: string): PNG {
  const buf = fs.readFileSync(filePath);
  return PNG.sync.read(buf);
}

export function bboxFromDiffPng(diffPath: string | null): Bbox | null {
  if (!diffPath || !fs.existsSync(diffPath)) return null;
  let png: PNG;
  try {
    png = readPng(diffPath);
  } catch {
    return null;
  }
  const { width, height, data } = png;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      if (r > DIFF_PIXEL_THRESHOLD || g > DIFF_PIXEL_THRESHOLD || b > DIFF_PIXEL_THRESHOLD) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;
  return {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
}

function nodeIntersectsBbox(node: A11yNode, bbox: Bbox | null): boolean {
  if (!bbox) return true;
  const meta = node as A11yNode & { _bbox?: Bbox; _rect?: DOMRect };
  if (meta._bbox) {
    const b = meta._bbox;
    return !(b.x + b.width < bbox.x || b.x > bbox.x + bbox.width || b.y + b.height < bbox.y || b.y > bbox.y + bbox.height);
  }
  return true;
}

export function truncateA11yByBbox(
  tree: A11yNode | null,
  bbox: Bbox | null,
  maxNodes = 500,
): { subtree: A11yNode | null; kept: number } {
  if (!tree) return { subtree: null, kept: 0 };

  let budget = maxNodes;

  function visit(node: A11yNode): A11yNode | null {
    if (budget <= 0) return null;
    if (!nodeIntersectsBbox(node, bbox)) return null;
    budget -= 1;
    const clone: A11yNode = { ...node };
    if (Array.isArray(node.children) && node.children.length > 0) {
      const newChildren: A11yNode[] = [];
      for (const child of node.children) {
        const visited = visit(child);
        if (visited) newChildren.push(visited);
        if (budget <= 0) break;
      }
      if (newChildren.length > 0) clone.children = newChildren;
      else delete clone.children;
    }
    return clone;
  }

  const subtree = visit(tree);
  if (!subtree) return { subtree: null, kept: 0 };
  const kept = maxNodes - budget;
  return { subtree, kept };
}

export function findAttachment(
  attachments: ReadonlyArray<{ name: string; path?: string }>,
  suffix: string,
): string | null {
  for (const a of attachments) {
    if (a.name.endsWith(suffix) && a.path && fs.existsSync(a.path)) {
      return a.path;
    }
  }
  return null;
}

export function ensureOutputDir(outputDir: string): void {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
}

export function writePayload(payload: AIPayload, outputDir: string): string {
  ensureOutputDir(outputDir);
  const filePath = path.join(outputDir, `payload-${payload.testId}.json`);
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));
  return filePath;
}
