/**
 * src/vfs.js
 * 虚拟文件系统 (Virtual File System) 树状 JSON 结构与路径解析引擎
 */

export const VFS_TREE = {
  name: '~',
  type: 'dir',
  permissions: 'drwxr-xr-x',
  owner: 'cirno',
  group: 'gensokyo',
  mtime: 'Oct 24 09:09',
  children: {
    links: {
      name: 'links',
      type: 'dir',
      permissions: 'drwxr-xr-x',
      owner: 'cirno',
      group: 'gensokyo',
      mtime: 'Oct 24 09:05',
      children: {
        'github.url': {
          name: 'github.url',
          type: 'file',
          permissions: '-rw-r--r--',
          owner: 'cirno',
          group: 'gensokyo',
          mtime: 'Oct 24 09:05',
          content: [
            '[InternetShortcut]',
            'Title=Cirno GitHub Profile',
            'URL=https://github.com/cirnomoe'
          ].join('\n')
        },
        'blog.url': {
          name: 'blog.url',
          type: 'file',
          permissions: '-rw-r--r--',
          owner: 'cirno',
          group: 'gensokyo',
          mtime: 'Oct 24 09:06',
          content: [
            '[InternetShortcut]',
            'Title=Rime.moe',
            'URL=https://rime.moe'
          ].join('\n')
        }
      }
    }
  }
};

/**
 * 将任意路径（支持 ~、.、..、相对路径及 /home/cirno 别名）规范化为以 ~ 开头的标准路径
 * @param {string} cwd 当前工作目录，如 '~' 或 '~/links'
 * @param {string} inputPath 目标路径
 * @returns {string} 规范化后的路径，如 '~' 或 '~/links/github.url'
 */
export function normalizePath(cwd = '~', inputPath = '') {
  const raw = (inputPath || '').trim();
  if (!raw || raw === '~') {
    return '~';
  }

  // 支持将 /home/cirno 或 / 视为 ~ 根路径映射
  let working = raw;
  if (working === '/home/cirno' || working === '/') {
    return '~';
  }
  if (working.startsWith('/home/cirno/')) {
    working = '~/' + working.slice('/home/cirno/'.length);
  } else if (working.startsWith('/')) {
    working = '~/' + working.slice(1);
  }

  let baseParts = [];
  if (working.startsWith('~')) {
    const rest = working.slice(1).replace(/^\/+/, '');
    baseParts = rest ? rest.split('/') : [];
  } else {
    const cwdRest = cwd === '~' ? '' : cwd.slice(2);
    baseParts = cwdRest ? cwdRest.split('/') : [];
    const relParts = working.split('/');
    baseParts.push(...relParts);
  }

  const stack = [];
  for (const part of baseParts) {
    if (!part || part === '.') continue;
    if (part === '..') {
      stack.pop();
    } else {
      stack.push(part);
    }
  }

  return stack.length === 0 ? '~' : `~/${stack.join('/')}`;
}

/**
 * 根据当前工作目录与输入路径查找对应的 VFS 节点
 * @param {string} cwd 当前路径
 * @param {string} targetPath 目标路径
 * @returns {{ path: string, node: object | null, error: string | null }}
 */
export function resolveVfsNode(cwd, targetPath) {
  const canonicalPath = normalizePath(cwd, targetPath);
  if (canonicalPath === '~') {
    return { path: '~', node: VFS_TREE, error: null };
  }

  const segments = canonicalPath.slice(2).split('/');
  let current = VFS_TREE;

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    if (current.type !== 'dir' || !current.children) {
      return {
        path: canonicalPath,
        node: null,
        error: 'NOT_A_DIR'
      };
    }
    const next = current.children[seg];
    if (!next) {
      return {
        path: canonicalPath,
        node: null,
        error: 'NOT_FOUND'
      };
    }
    if (i < segments.length - 1 && next.type !== 'dir') {
      return {
        path: canonicalPath,
        node: null,
        error: 'NOT_A_DIR'
      };
    }
    current = next;
  }

  return { path: canonicalPath, node: current, error: null };
}

/**
 * 计算文件节点的字节大小（用于 ls -l 展示）
 * @param {object} node VFS 节点
 * @returns {number}
 */
export function getNodeByteSize(node) {
  if (!node) return 0;
  if (node.type === 'dir') {
    return 4096;
  }
  return new TextEncoder().encode(node.content || '').length;
}

/**
 * 将内部 ~ 路径转换为完整 Unix 风格绝对路径（供 pwd 使用）
 * @param {string} cwd 当前路径（如 '~' 或 '~/links'）
 * @returns {string} 如 '/home/cirno' 或 '/home/cirno/links'
 */
export function toUnixAbsolutePath(cwd) {
  if (!cwd || cwd === '~') {
    return '/home/cirno';
  }
  return `/home/cirno/${cwd.slice(2)}`;
}
