/**
 * src/commands.js
 * 终端命令注册表、命令调度器与格式化渲染逻辑
 */

import {
  resolveVfsNode,
  getNodeByteSize,
  toUnixAbsolutePath
} from './vfs.js';

export const AVAILABLE_THEMES = ['cirno', 'matrix', 'amber'];

/**
 * 支持的全部命令元数据列表（用于 help 对齐输出与 Tab 自动补全）
 */
export const COMMAND_SCHEMAS = [
  {
    name: 'help',
    usage: 'help',
    desc: '列出所有受支持的终端指令'
  },
  {
    name: 'ls',
    usage: 'ls [-l] [path]',
    desc: '列出目录内容'
  },
  {
    name: 'cd',
    usage: 'cd <path>',
    desc: '切换当前工作目录'
  },
  {
    name: 'cat',
    usage: 'cat <file>',
    desc: '查看文件内容'
  },
  {
    name: 'pwd',
    usage: 'pwd',
    desc: '打印当前所在的工作目录绝对路径'
  },
  {
    name: 'clear',
    usage: 'clear',
    desc: '清空当前终端屏幕输出缓冲区'
  },
  {
    name: 'fastfetch',
    usage: 'fastfetch',
    desc: '显示系统环境概览信息列表'
  },
  {
    name: 'theme',
    usage: 'theme [cirno|matrix|amber]',
    desc: '查看或切换终端配色主题'
  },
  {
    name: 'curl',
    usage: 'curl [url]',
    desc: '发起虚拟网络请求'
  }
];

export const COMMAND_NAMES = COMMAND_SCHEMAS.map((item) => item.name);

/**
 * HTML 实体转义，防止注入并确保特殊符号安全展示
 * @param {string} str
 * @returns {string}
 */
export function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * 将文本中的 Markdown 链接 [text](url)、.url 键值或裸 URL 渲染为可点击的 <a> 超链接
 * @param {string} rawText 原始文本
 * @param {string} fileName 文件名
 * @returns {string} 安全的 HTML 字符串
 */
export function formatFileContentWithLinks(rawText, fileName = '') {
  const isUrlFile = fileName.endsWith('.url');
  const isMarkdown = fileName.endsWith('.md');

  const lines = String(rawText).split('\n');
  const renderedLines = lines.map((line) => {
    // 针对 .url 文件中的 URL=https://... 行做专门高亮渲染
    if (isUrlFile && /^URL\s*=\s*(https?:\/\/\S+)$/i.test(line.trim())) {
      const match = line.trim().match(/^URL\s*=\s*(https?:\/\/\S+)$/i);
      const url = match[1];
      const safeUrl = escapeHtml(url);
      return `<span class="c-accent c-bold">URL=</span><a class="term-link" href="${safeUrl}" target="_blank" rel="noopener noreferrer">${safeUrl} ↗</a>`;
    }

    // 使用占位符分步替换 Markdown 链接与裸链接，避免二次转义
    const tokens = [];
    let processed = line.replace(
      /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
      (_, label, url) => {
        const token = `__LINK_TOKEN_${tokens.length}__`;
        const safeLabel = escapeHtml(label);
        const safeUrl = escapeHtml(url);
        tokens.push(
          `<a class="term-link" href="${safeUrl}" target="_blank" rel="noopener noreferrer">${safeLabel} (${safeUrl})</a>`
        );
        return token;
      }
    );

    processed = processed.replace(/(https?:\/\/[^\s<>")]+)/g, (url) => {
      const token = `__LINK_TOKEN_${tokens.length}__`;
      const safeUrl = escapeHtml(url);
      tokens.push(
        `<a class="term-link" href="${safeUrl}" target="_blank" rel="noopener noreferrer">${safeUrl}</a>`
      );
      return token;
    });

    let escaped = escapeHtml(processed);

    // Markdown 标题与引用润色
    if (isMarkdown) {
      if (/^#{1,3}\s+/.test(line)) {
        escaped = `<span class="c-secondary c-bold">${escaped}</span>`;
      } else if (/^>\s+/.test(line)) {
        escaped = `<span class="c-muted">${escaped}</span>`;
      }
    }

    tokens.forEach((htmlSnippet, idx) => {
      escaped = escaped.replace(`__LINK_TOKEN_${idx}__`, htmlSnippet);
    });

    return escaped;
  });

  return renderedLines.join('\n');
}

/**
 * 构建首次进入终端时的欢迎 ASCII Banner HTML
 * @returns {string}
 */
export function renderWelcomeBanner() {
  const bannerArt = [
    '   ______   ____   ____     _   __   ____         ______   __    ____',
    '  / ____/  /  _/  / __ \\   / | / /  / __ \\       / ____/  / /   /  _/',
    ' / /       / /   / /_/ /  /  |/ /  / / / /      / /      / /    / /  ',
    '/ /___   _/ /   / _, _/  / /|  /  / /_/ /      / /___   / /____/ /   ',
    '\\____/  /___/  /_/ |_|  /_/ |_/   \\____/       \\____/  /_____/___/   ',
    '                                                                     ',
    '        ❄️  R I M E . M O E  ::  Frost Web Terminal  ❄️'
  ].join('\n');

  return [
    `<div class="ascii-banner">${escapeHtml(bannerArt)}</div>`,
    `<div>Welcome to <span class="c-secondary c-bold">rime.moe</span></div>`,
    `<div class="c-muted">Explorer: <span class="c-accent">cirno</span> | Stack: <span class="c-secondary">Arch Linux / Python / Rust 🦀</span> | GitHub: <a class="term-link" href="https://github.com/cirnomoe" target="_blank" rel="noopener noreferrer">github.com/cirnomoe</a></div>`,
    `<div style="margin-top: 4px;">Type <span class="c-warn c-bold">'help'</span> to get started.</div>`
  ].join('');
}

/**
 * 构建 fastfetch 输出 HTML
 * @param {string} currentTheme
 * @returns {string}
 */
function renderFastfetch(currentTheme = 'cirno') {
  const specs = [
    ['OS', 'Arch Linux x86_64'],
    ['Host', 'rime.moe'],
    ['Kernel', 'linux-zen'],
    ['Shell', 'zsh'],
    ['Learning', 'Python, Rust'],
    ['Memory', '999MiB / 9999MiB'],
    ['Theme', currentTheme],
    [
      'GitHub',
      '<a class="term-link" href="https://github.com/cirnomoe" target="_blank" rel="noopener noreferrer">https://github.com/cirnomoe</a>'
    ]
  ];

  const keyWidth = 10;
  const infoLines = [
    `<span class="c-accent c-bold">cirno</span><span class="c-muted">@</span><span class="c-secondary c-bold">rime.moe</span>`,
    `<span class="c-muted">------------------------------</span>`,
    ...specs.map(([key, val]) => {
      const paddedKey = escapeHtml(key).padEnd(keyWidth, ' ');
      const renderedVal = key === 'GitHub' ? val : escapeHtml(val);
      return `<span class="fastfetch-key">${paddedKey}</span>: ${renderedVal}`;
    })
  ];

  const paletteColors = [
    '#090d16',
    '#56c8ff',
    '#7bf0ff',
    '#e2f1f8',
    '#ffaa44',
    '#ff5252'
  ];
  const swatches = paletteColors
    .map(
      (hex) =>
        `<span class="palette-swatch" style="background-color: ${hex}; border: 1px solid rgba(255,255,255,0.2);" title="${hex}"></span>`
    )
    .join('');

  infoLines.push(`<div class="fastfetch-palette">${swatches}</div>`);

  return `<div class="fastfetch-info">${infoLines.join('\n')}</div>`;
}

/**
 * 解析命令行参数（支持引号包裹）
 * @param {string} rawLine
 * @returns {string[]}
 */
export function parseCommandArgs(rawLine) {
  const args = [];
  const regex = /[^\s"']+|"([^"]*)"|'([^']*)'/g;
  let match;
  while ((match = regex.exec(rawLine)) !== null) {
    args.push(match[1] ?? match[2] ?? match[0]);
  }
  return args;
}

/**
 * 执行单条终端指令
 * @param {string} rawInput 用户输入的原始命令字符串
 * @param {object} context 终端状态上下文 { cwd, theme, setCwd, setTheme, clearScreen }
 * @returns {{ html?: string, cleared?: boolean }}
 */
export function executeCommand(rawInput, context) {
  const trimmed = (rawInput || '').trim();
  if (!trimmed) {
    return { html: '' };
  }

  const tokens = parseCommandArgs(trimmed);
  const cmd = (tokens[0] || '').toLowerCase();
  const args = tokens.slice(1);

  switch (cmd) {
    case 'help': {
      const maxUsageLen = Math.max(...COMMAND_SCHEMAS.map((c) => c.usage.length)) + 4;
      const rows = COMMAND_SCHEMAS.map((item) => {
        const paddedUsage = escapeHtml(item.usage.padEnd(maxUsageLen, ' '));
        return `  <span class="c-secondary c-bold">${paddedUsage}</span><span class="c-muted">-</span> ${escapeHtml(item.desc)}`;
      });

      return {
        html: [
          `<span class="c-accent c-bold">❄️  RIME.MOE SHELL COMMAND REFERENCE</span>`,
          `<span class="c-muted">----------------------------------------------------------------------</span>`,
          ...rows,
          `<span class="c-muted">----------------------------------------------------------------------</span>`,
          `<span class="c-muted">Shortcuts: <span class="c-warn">[Tab]</span> 自动补全  <span class="c-warn">[↑/↓]</span> 历史命令  <span class="c-warn">[Ctrl+L]</span> 清屏  <span class="c-warn">[Ctrl+C]</span> 中断输入</span>`
        ].join('\n')
      };
    }

    case 'ls': {
      let showLong = false;
      const targetArgs = [];

      for (const arg of args) {
        if (arg.startsWith('-') && arg.length > 1) {
          if (arg.includes('l')) {
            showLong = true;
          } else {
            return {
              html: `<span class="c-error">ls: invalid option -- '${escapeHtml(arg.slice(1))}'</span>\nTry 'ls [-l] [path]'.`
            };
          }
        } else {
          targetArgs.push(arg);
        }
      }

      const targetPath = targetArgs[0] || '.';
      const resolved = resolveVfsNode(context.cwd, targetPath);

      if (resolved.error || !resolved.node) {
        return {
          html: `<span class="c-error">ls: cannot access '${escapeHtml(targetPath)}': No such file or directory</span>`
        };
      }

      const node = resolved.node;

      // 若目标是单个文件
      if (node.type === 'file') {
        if (showLong) {
          const sizeStr = String(getNodeByteSize(node)).padStart(5, ' ');
          return {
            html: `${escapeHtml(node.permissions)} 1 ${escapeHtml(node.owner)} ${escapeHtml(node.group)} ${sizeStr} ${escapeHtml(node.mtime)} <span class="ls-file">${escapeHtml(node.name)}</span>`
          };
        }
        return {
          html: `<span class="ls-file">${escapeHtml(node.name)}</span>`
        };
      }

      // 目标是目录
      const entries = Object.values(node.children || {}).sort((a, b) => {
        if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
        return a.name.localeCompare(b.name);
      });

      if (entries.length === 0) {
        return { html: '' };
      }

      const formatEntryName = (entry) => {
        if (entry.type === 'dir') {
          return `<span class="ls-dir">${escapeHtml(entry.name)}/</span>`;
        }
        if (entry.name.endsWith('.url')) {
          return `<span class="ls-url">${escapeHtml(entry.name)}</span>`;
        }
        if (entry.name.endsWith('.md')) {
          return `<span class="ls-md">${escapeHtml(entry.name)}</span>`;
        }
        return `<span class="ls-file">${escapeHtml(entry.name)}</span>`;
      };

      if (showLong) {
        const lines = [`<span class="c-muted">total ${entries.length * 4}</span>`];
        for (const entry of entries) {
          const sizeStr = String(getNodeByteSize(entry)).padStart(5, ' ');
          lines.push(
            `${escapeHtml(entry.permissions)} 1 ${escapeHtml(entry.owner)} ${escapeHtml(entry.group)} ${sizeStr} ${escapeHtml(entry.mtime)} ${formatEntryName(entry)}`
          );
        }
        return { html: lines.join('\n') };
      }

      return {
        html: `<div class="ls-row">${entries.map(formatEntryName).join('')}</div>`
      };
    }

    case 'cd': {
      if (args.length > 1) {
        return {
          html: `<span class="c-error">cd: too many arguments</span>`
        };
      }

      const targetPath = args[0] || '~';
      const resolved = resolveVfsNode(context.cwd, targetPath);

      if (resolved.error === 'NOT_FOUND' || !resolved.node) {
        return {
          html: `<span class="c-error">cd: no such file or directory: ${escapeHtml(targetPath)}</span>`
        };
      }

      if (resolved.error === 'NOT_A_DIR' || resolved.node.type !== 'dir') {
        return {
          html: `<span class="c-error">cd: not a directory: ${escapeHtml(targetPath)}</span>`
        };
      }

      context.setCwd(resolved.path);
      return { html: '' };
    }

    case 'cat': {
      if (args.length === 0) {
        return {
          html: `<span class="c-error">cat: missing file operand</span>\nUsage: <span class="c-secondary">cat &lt;file&gt;</span>`
        };
      }

      const outputs = [];
      for (const fileArg of args) {
        const resolved = resolveVfsNode(context.cwd, fileArg);
        if (resolved.error === 'NOT_FOUND' || !resolved.node) {
          outputs.push(
            `<span class="c-error">cat: ${escapeHtml(fileArg)}: No such file or directory</span>`
          );
          continue;
        }
        if (resolved.node.type === 'dir') {
          outputs.push(
            `<span class="c-error">cat: ${escapeHtml(fileArg)}: Is a directory</span>`
          );
          continue;
        }
        outputs.push(
          formatFileContentWithLinks(resolved.node.content, resolved.node.name)
        );
      }

      return { html: outputs.join('\n') };
    }

    case 'pwd': {
      const absPath = toUnixAbsolutePath(context.cwd);
      return {
        html: escapeHtml(absPath)
      };
    }

    case 'clear': {
      context.clearScreen();
      return { cleared: true };
    }

    case 'fastfetch': {
      return {
        html: renderFastfetch(context.theme)
      };
    }

    case 'theme': {
      if (args.length === 0) {
        const listStr = AVAILABLE_THEMES.map((t) =>
          t === context.theme
            ? `<span class="c-secondary c-bold">[${t} *]</span>`
            : `<span class="c-muted">${t}</span>`
        ).join('  ');
        return {
          html: [
            `Current active theme: <span class="c-accent c-bold">${escapeHtml(context.theme)}</span>`,
            `Available themes    : ${listStr}`,
            `Usage               : <span class="c-warn">theme [cirno|matrix|amber]</span>`
          ].join('\n')
        };
      }

      const nextTheme = args[0].toLowerCase();
      if (!AVAILABLE_THEMES.includes(nextTheme)) {
        return {
          html: `<span class="c-error">theme: unknown preset '${escapeHtml(args[0])}'</span>\nAvailable themes: <span class="c-secondary">cirno</span> | <span class="c-secondary">matrix</span> | <span class="c-secondary">amber</span>`
        };
      }

      context.setTheme(nextTheme);
      const themeNotes = {
        cirno: '❄️ 已切换至 [cirno] 琪露诺冰霜蓝调主题',
        matrix: '🟢 已切换至 [matrix] 黑客帝国磷光绿主题',
        amber: '🟠 已切换至 [amber] 复古琥珀显像管主题'
      };
      return {
        html: `<span class="c-secondary c-bold">${escapeHtml(themeNotes[nextTheme])}</span>`
      };
    }

    case 'curl': {
      if (args.length === 0) {
        return {
          html: `<span class="c-error">curl: try 'curl rime.moe' for a frozen surprise! ❄️</span>`
        };
      }

      const rawUrl = args[0].toLowerCase().replace(/^https?:\/\//, '').replace(/\/+$/, '');

      if (rawUrl === 'rime.moe' || rawUrl === 'www.rime.moe') {
        const iceArt = [
          '  HTTP 200 OK',
          '  Content-Type: text/frost; charset=utf-8',
          '',
          '      ❄️  *  .  ❄️  .  *  ❄️  .  *  ❄️',
          '    ======================================',
          '       WELCOME TO RIME.MOE ICE CASTLE!    ',
          '    ======================================',
          '      ▸ Explorer : Cirno',
          '      ▸ OS       : Arch Linux',
          '      ▸ Coding   : Python 🐍 & Rust 🦀',
          '      ▸ GitHub   : https://github.com/cirnomoe',
          '      ❄️  *  .  ❄️  .  *  ❄️  .  *  ❄️'
        ].join('\n');

        return {
          html: `<span class="c-warn">${formatFileContentWithLinks(iceArt, 'curl.txt')}</span>`
        };
      }

      return {
        html: [
          `<span class="c-muted">GET https://${escapeHtml(rawUrl)}</span>`,
          `<span class="c-warn">curl: (9) Frozen route to host '${escapeHtml(args[0])}'.</span>`,
          `Tip: Try <span class="c-secondary c-bold">curl rime.moe</span> to trigger the easter egg!`
        ].join('\n')
      };
    }

    default: {
      return {
        html: `<span class="c-error">zsh: command not found: ${escapeHtml(cmd)}</span>\nType <span class="c-warn c-bold">'help'</span> to view available commands.`
      };
    }
  }
}
