import test from 'node:test';
import assert from 'node:assert/strict';
import { VFS_TREE, normalizePath, resolveVfsNode, toUnixAbsolutePath } from '../src/vfs.js';
import { executeCommand, renderWelcomeBanner } from '../src/commands.js';
import { TerminalEngine } from '../src/engine.js';

test('VFS: 根目录仅保留 links 目录及对应链接文件', () => {
  assert.deepEqual(Object.keys(VFS_TREE.children), ['links']);
  const githubNode = resolveVfsNode('~', 'links/github.url');
  assert.equal(githubNode.error, null);
  assert.equal(githubNode.node.type, 'file');
  assert.match(githubNode.node.content, /https:\/\/github\.com\/cirnomoe/);
});

test('VFS: 路径解析支持 ~、.、.. 与相对路径', () => {
  assert.equal(normalizePath('~', 'links'), '~/links');
  assert.equal(normalizePath('~/links', '..'), '~');
  assert.equal(normalizePath('~/links', './github.url'), '~/links/github.url');
  assert.equal(toUnixAbsolutePath('~/links'), '/home/cirno/links');
});

test('Commands: fastfetch 输出无字符画且无版本号的系统信息列表', () => {
  const ctx = {
    cwd: '~',
    theme: 'cirno',
    setCwd() {},
    setTheme() {},
    clearScreen() {}
  };

  const res = executeCommand('fastfetch', ctx);
  assert.match(res.html, /Arch Linux x86_64/);
  assert.match(res.html, /linux-zen/);
  assert.match(res.html, /zsh/);
  assert.match(res.html, /999MiB \/ 9999MiB/);
  assert.doesNotMatch(res.html, /9\.9\.9|5\.9/);
});

test('Commands: ls / cd / cat / theme / curl 行为正确', () => {
  let cwd = '~';
  let theme = 'cirno';
  const ctx = {
    get cwd() {
      return cwd;
    },
    get theme() {
      return theme;
    },
    setCwd(next) {
      cwd = next;
    },
    setTheme(next) {
      theme = next;
    },
    clearScreen() {}
  };

  assert.match(executeCommand('ls', ctx).html, /links\//);
  executeCommand('cd links', ctx);
  assert.equal(cwd, '~/links');

  const catRes = executeCommand('cat github.url', ctx);
  assert.match(catRes.html, /href="https:\/\/github\.com\/cirnomoe"/);

  executeCommand('theme matrix', ctx);
  assert.equal(theme, 'matrix');

  assert.match(executeCommand('curl cirno9.moe', ctx).html, /WELCOME TO CIRNO9\.MOE/);
});

test('TerminalEngine: Tab 补全、历史记录栈、Ctrl+C 与 Ctrl+L', () => {
  const makeEl = () => ({
    innerHTML: '',
    textContent: '',
    value: '',
    scrollTop: 0,
    scrollHeight: 100,
    selectionStart: 0,
    children: [],
    classList: { add() {}, remove() {} },
    appendChild(child) {
      this.children.push(child);
    },
    addEventListener() {},
    focus() {},
    setSelectionRange(s) {
      this.selectionStart = s;
    }
  });

  globalThis.document = {
    title: '',
    documentElement: { setAttribute() {} },
    createElement: () => makeEl(),
    addEventListener() {}
  };
  globalThis.window = { getSelection: () => ({ toString: () => '' }) };
  globalThis.requestAnimationFrame = (cb) => cb();

  const els = {
    viewportEl: makeEl(),
    outputEl: makeEl(),
    inputLineEl: makeEl(),
    promptEl: makeEl(),
    inputEl: makeEl(),
    beforeEl: makeEl(),
    cursorEl: makeEl(),
    afterEl: makeEl(),
    titleEl: makeEl()
  };

  const engine = new TerminalEngine(els);
  engine.init();

  // Tab 自动补全 fastfetch
  els.inputEl.value = 'fast';
  engine.handleKeyDown({ key: 'Tab', ctrlKey: false, preventDefault() {} });
  assert.equal(els.inputEl.value, 'fastfetch ');

  // 执行命令并测试上下键历史记录
  els.inputEl.value = 'pwd';
  engine.handleKeyDown({ key: 'Enter', ctrlKey: false, preventDefault() {} });
  engine.handleKeyDown({ key: 'ArrowUp', ctrlKey: false, preventDefault() {} });
  assert.equal(els.inputEl.value, 'pwd');

  // Ctrl + C 打断输入
  els.inputEl.value = 'cd unknown';
  engine.handleKeyDown({ key: 'c', ctrlKey: true, preventDefault() {} });
  assert.equal(els.inputEl.value, '');

  // Ctrl + L 清屏
  engine.handleKeyDown({ key: 'l', ctrlKey: true, preventDefault() {} });
  assert.equal(els.outputEl.innerHTML, '');
});
