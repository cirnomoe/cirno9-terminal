/**
 * src/engine.js
 * 终端核心交互控制引擎：管理状态机、历史命令栈、Tab 补全、快捷键拦截与光标同步
 */

import { resolveVfsNode } from './vfs.js';
import {
  COMMAND_NAMES,
  AVAILABLE_THEMES,
  escapeHtml,
  executeCommand,
  renderWelcomeBanner
} from './commands.js';

export class TerminalEngine {
  /**
   * @param {object} elements DOM 节点引用集合
   */
  constructor(elements) {
    this.viewportEl = elements.viewportEl;
    this.outputEl = elements.outputEl;
    this.inputLineEl = elements.inputLineEl;
    this.promptEl = elements.promptEl;
    this.inputEl = elements.inputEl;
    this.beforeEl = elements.beforeEl;
    this.cursorEl = elements.cursorEl;
    this.afterEl = elements.afterEl;
    this.titleEl = elements.titleEl;

    // 终端运行时状态
    this.cwd = '~';
    this.theme = 'cirno';
    this.history = [];
    this.historyIndex = -1;
    this.draftInput = '';
    this.typingTimer = null;
  }

  /**
   * 启动终端：挂载事件监听器、渲染初始欢迎 Banner 并聚焦输入
   */
  init() {
    this.updatePromptUI();
    this.printBanner();
    this.bindEvents();
    this.syncInputMirror();
    this.focusInput();
  }

  /**
   * 获取当前 Prompt 字符串，如 "cirno@cirno9.moe:~$ "
   * @returns {string}
   */
  getPromptText() {
    return `cirno@cirno9.moe:${this.cwd}$ `;
  }

  /**
   * 获取带语义高亮的 Prompt HTML
   * @returns {string}
   */
  getPromptHtml() {
    return `<span class="prompt-user">cirno</span><span class="prompt-at">@</span><span class="prompt-host">cirno9.moe</span><span class="prompt-at">:</span><span class="prompt-path">${escapeHtml(this.cwd)}</span><span class="prompt-dollar">$</span> `;
  }

  /**
   * 更新当前命令行提示符与窗口标题栏
   */
  updatePromptUI() {
    this.promptEl.innerHTML = this.getPromptHtml();
    if (this.titleEl) {
      this.titleEl.textContent = `cirno@cirno9.moe: ${this.cwd}`;
    }
    document.title = `cirno@cirno9.moe:${this.cwd}`;
  }

  /**
   * 打印首次进入时的 ASCII 欢迎横幅与引导提示
   */
  printBanner() {
    this.appendOutputHtml(renderWelcomeBanner());
  }

  /**
   * 向终端缓冲区追加一段 HTML 输出块
   * @param {string} htmlContent
   */
  appendOutputHtml(htmlContent) {
    if (!htmlContent) return;
    const block = document.createElement('div');
    block.className = 'output-block';
    block.innerHTML = htmlContent;
    this.outputEl.appendChild(block);
    this.scrollToBottom();
  }

  /**
   * 将已执行或被打断的命令行固化到历史屏幕输出中
   * @param {string} rawCommand
   * @param {boolean} interrupted 是否被 Ctrl+C 打断
   */
  echoCommandLine(rawCommand, interrupted = false) {
    const lineDiv = document.createElement('div');
    lineDiv.className = 'history-cmd-line';
    const suffix = interrupted ? '<span class="c-error c-bold">^C</span>' : '';
    lineDiv.innerHTML = `<span class="terminal-prompt">${this.getPromptHtml()}</span><span class="input-text">${escapeHtml(rawCommand)}</span>${suffix}`;
    this.outputEl.appendChild(lineDiv);
    this.scrollToBottom();
  }

  /**
   * 清空当前输出缓冲区
   */
  clearScreen() {
    this.outputEl.innerHTML = '';
    this.scrollToBottom();
  }

  /**
   * 切换终端配色主题
   * @param {string} nextTheme
   */
  setTheme(nextTheme) {
    this.theme = nextTheme;
    document.documentElement.setAttribute('data-theme', nextTheme);
  }

  /**
   * 切换当前工作目录
   * @param {string} nextCwd
   */
  setCwd(nextCwd) {
    this.cwd = nextCwd;
    this.updatePromptUI();
  }

  /**
   * 绑定键盘与鼠标事件
   */
  bindEvents() {
    // 页面任意空白处点击，强制让隐藏的 <input> 维持焦点（若用户正在划词复制或点击链接则不抢夺）
    document.addEventListener('click', (event) => {
      if (event.target.closest('a.term-link')) {
        return;
      }
      const selection = window.getSelection();
      if (selection && selection.toString().length > 0) {
        return;
      }
      this.focusInput();
    });

    // 输入内容变化时同步镜像文本与方块光标位置
    this.inputEl.addEventListener('input', () => {
      this.markTypingActivity();
      this.syncInputMirror();
    });

    // 拦截功能键与组合快捷键
    this.inputEl.addEventListener('keydown', (event) => {
      this.handleKeyDown(event);
    });

    this.inputEl.addEventListener('keyup', () => {
      this.syncInputMirror();
    });
  }

  /**
   * 触发输入态防抖，输入过程中暂停光标闪烁以提升视觉跟手度
   */
  markTypingActivity() {
    this.inputLineEl.classList.add('is-typing');
    if (this.typingTimer) {
      clearTimeout(this.typingTimer);
    }
    this.typingTimer = setTimeout(() => {
      this.inputLineEl.classList.remove('is-typing');
    }, 450);
  }

  /**
   * 聚焦隐藏的原生 <input>
   */
  focusInput() {
    this.inputEl.focus({ preventScroll: true });
  }

  /**
   * 滚动视口到底部
   */
  scrollToBottom() {
    requestAnimationFrame(() => {
      this.viewportEl.scrollTop = this.viewportEl.scrollHeight;
    });
  }

  /**
   * 将隐藏 <input> 的内容及光标位置同步渲染到可视 DOM 镜像与 "_" 下划线光标上
   */
  syncInputMirror() {
    const val = this.inputEl.value;
    const caretPos =
      typeof this.inputEl.selectionStart === 'number'
        ? this.inputEl.selectionStart
        : val.length;

    this.beforeEl.textContent = val.slice(0, caretPos);
    this.cursorEl.textContent = '_';
    this.afterEl.textContent = val.slice(caretPos);
  }

  /**
   * 键盘事件核心调度器
   * @param {KeyboardEvent} event
   */
  handleKeyDown(event) {
    // Ctrl + L: 清屏
    if (event.ctrlKey && (event.key === 'l' || event.key === 'L')) {
      event.preventDefault();
      this.clearScreen();
      return;
    }

    // Ctrl + C: 打断当前输入行并新起一行提示符
    if (event.ctrlKey && (event.key === 'c' || event.key === 'C')) {
      event.preventDefault();
      const currentVal = this.inputEl.value;
      this.echoCommandLine(currentVal, true);
      this.resetCurrentInput();
      return;
    }

    switch (event.key) {
      case 'Enter': {
        event.preventDefault();
        this.submitCurrentCommand();
        break;
      }

      case 'Tab': {
        event.preventDefault();
        this.handleTabCompletion();
        break;
      }

      case 'ArrowUp': {
        event.preventDefault();
        this.navigateHistory(-1);
        break;
      }

      case 'ArrowDown': {
        event.preventDefault();
        this.navigateHistory(1);
        break;
      }

      case 'ArrowLeft':
      case 'ArrowRight':
      case 'Home':
      case 'End': {
        requestAnimationFrame(() => this.syncInputMirror());
        break;
      }

      default:
        break;
    }
  }

  /**
   * 重置当前输入框状态
   */
  resetCurrentInput() {
    this.inputEl.value = '';
    this.historyIndex = this.history.length;
    this.draftInput = '';
    this.syncInputMirror();
    this.scrollToBottom();
  }

  /**
   * 提交并执行当前输入的指令
   */
  submitCurrentCommand() {
    const rawLine = this.inputEl.value;
    this.echoCommandLine(rawLine, false);

    const trimmed = rawLine.trim();
    if (trimmed) {
      // 避免连续重复记录相同命令
      if (this.history[this.history.length - 1] !== rawLine) {
        this.history.push(rawLine);
      }
    }

    this.resetCurrentInput();

    if (!trimmed) {
      return;
    }

    const result = executeCommand(trimmed, {
      cwd: this.cwd,
      theme: this.theme,
      setCwd: (nextCwd) => this.setCwd(nextCwd),
      setTheme: (nextTheme) => this.setTheme(nextTheme),
      clearScreen: () => this.clearScreen()
    });

    if (!result.cleared && result.html) {
      this.appendOutputHtml(result.html);
    }
  }

  /**
   * 上下方向键遍历历史命令栈
   * @param {number} direction -1 表示向上 (ArrowUp)，1 表示向下 (ArrowDown)
   */
  navigateHistory(direction) {
    if (this.history.length === 0) return;

    if (this.historyIndex === -1) {
      this.historyIndex = this.history.length;
    }

    // 首次从底部向上翻时，保存当前未提交的草稿内容
    if (this.historyIndex === this.history.length && direction === -1) {
      this.draftInput = this.inputEl.value;
    }

    const nextIndex = this.historyIndex + direction;
    if (nextIndex < 0 || nextIndex > this.history.length) {
      return;
    }

    this.historyIndex = nextIndex;
    if (this.historyIndex === this.history.length) {
      this.inputEl.value = this.draftInput;
    } else {
      this.inputEl.value = this.history[this.historyIndex];
    }

    // 将光标移至末尾
    const len = this.inputEl.value.length;
    this.inputEl.setSelectionRange(len, len);
    this.syncInputMirror();
  }

  /**
   * Tab 键智能自动补全：
   * - 第一个词补全命令名称
   * - 后续参数补全当前目录/目标路径下的文件与文件夹（或 theme 预设名）
   */
  handleTabCompletion() {
    const raw = this.inputEl.value;
    const isLeadingToken = !/\s/.test(raw.trimStart());

    // 1. 补全指令名
    if (isLeadingToken) {
      const prefix = raw.trimStart().toLowerCase();
      const matches = COMMAND_NAMES.filter((name) => name.startsWith(prefix));

      if (matches.length === 1) {
        this.applyInputCompletion(`${matches[0]} `);
      } else if (matches.length > 1) {
        const common = this.findLongestCommonPrefix(matches);
        if (common.length > prefix.length) {
          this.applyInputCompletion(common);
        }
        this.echoCommandLine(raw, false);
        this.appendOutputHtml(
          `<div class="ls-row">${matches.map((m) => `<span class="c-secondary">${escapeHtml(m)}</span>`).join('')}</div>`
        );
      }
      return;
    }

    // 2. 补全参数（路径或主题名）
    const lastSpaceIdx = raw.lastIndexOf(' ');
    const headPart = raw.slice(0, lastSpaceIdx + 1);
    const partialArg = raw.slice(lastSpaceIdx + 1);
    const cmdName = raw.trimStart().split(/\s+/)[0].toLowerCase();

    // 若当前指令是 theme，优先补全主题名称
    if (cmdName === 'theme') {
      const matches = AVAILABLE_THEMES.filter((t) =>
        t.startsWith(partialArg.toLowerCase())
      );
      if (matches.length === 1) {
        this.applyInputCompletion(`${headPart}${matches[0]}`);
      } else if (matches.length > 1) {
        this.echoCommandLine(raw, false);
        this.appendOutputHtml(
          `<div class="ls-row">${matches.map((t) => `<span class="c-secondary">${escapeHtml(t)}</span>`).join('')}</div>`
        );
      }
      return;
    }

    // 针对文件路径参数进行目录与文件补全
    const lastSlashIdx = partialArg.lastIndexOf('/');
    const dirPrefix =
      lastSlashIdx === -1 ? '' : partialArg.slice(0, lastSlashIdx + 1);
    const namePrefix =
      lastSlashIdx === -1 ? partialArg : partialArg.slice(lastSlashIdx + 1);
    const lookupDir = dirPrefix ? dirPrefix : '.';

    const resolvedDir = resolveVfsNode(this.cwd, lookupDir);
    if (
      resolvedDir.error ||
      !resolvedDir.node ||
      resolvedDir.node.type !== 'dir'
    ) {
      return;
    }

    const candidates = Object.values(resolvedDir.node.children || {}).filter(
      (entry) => {
        if (cmdName === 'cd' && entry.type !== 'dir') return false;
        return entry.name.startsWith(namePrefix);
      }
    );

    if (candidates.length === 1) {
      const target = candidates[0];
      const suffix = target.type === 'dir' ? '/' : ' ';
      this.applyInputCompletion(`${headPart}${dirPrefix}${target.name}${suffix}`);
    } else if (candidates.length > 1) {
      const names = candidates.map((c) => c.name);
      const common = this.findLongestCommonPrefix(names);
      if (common.length > namePrefix.length) {
        this.applyInputCompletion(`${headPart}${dirPrefix}${common}`);
      }
      this.echoCommandLine(raw, false);
      const formattedList = candidates
        .map((c) =>
          c.type === 'dir'
            ? `<span class="ls-dir">${escapeHtml(c.name)}/</span>`
            : `<span class="ls-file">${escapeHtml(c.name)}</span>`
        )
        .join('');
      this.appendOutputHtml(`<div class="ls-row">${formattedList}</div>`);
    }
  }

  /**
   * 应用自动补全结果并把光标置于末尾
   * @param {string} nextValue
   */
  applyInputCompletion(nextValue) {
    this.inputEl.value = nextValue;
    const len = nextValue.length;
    this.inputEl.setSelectionRange(len, len);
    this.syncInputMirror();
  }

  /**
   * 计算字符串数组的最长公共前缀
   * @param {string[]} list
   * @returns {string}
   */
  findLongestCommonPrefix(list) {
    if (!list || list.length === 0) return '';
    let prefix = list[0];
    for (let i = 1; i < list.length; i++) {
      while (!list[i].startsWith(prefix)) {
        prefix = prefix.slice(0, -1);
        if (!prefix) return '';
      }
    }
    return prefix;
  }
}
