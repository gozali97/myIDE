import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';
const source = readFileSync(new URL('../out/vs/platform/windows/electron-main/gozappSplashScreen.js', import.meta.url), 'utf8')
    .replace(/^import .*;$/gm, '').replace(/export \{[\s\S]*?\};/g, '') + '\nglobalThis.GozappSplashScreen = GozappSplashScreen;';
let window;
let timerCleared = false;
class FakeWindow {
    constructor(options) { this.options = options; this.events = {}; window = this; }
    once(name, callback) { this.events[name] = callback; }
    loadURL(url) { this.url = url; return Promise.resolve(); }
    isDestroyed() { return !!this.destroyed; }
    destroy() { this.destroyed = true; }
    show() { this.shown = true; }
}
const context = vm.createContext({ electron: { BrowserWindow: FakeWindow }, join,
    readFileSync: () => Buffer.from('logo'), setTimeout: () => 1, clearTimeout: () => { timerCleared = true; } });
vm.runInContext(source, context);
const Splash = context.GozappSplashScreen;
const env = { appRoot: '/tmp/path with spaces', args: {} };
const log = { warn() {} };
for (const arg of ['version', 'help', 'status', 'wait', 'diff']) {
    assert.equal(new Splash({ ...env, args: { [arg]: true } }, log).shouldShow(), false);
}
assert.equal(new Splash({ ...env, extensionTestsLocationURI: {} }, log).shouldShow(), false);
const splash = new Splash(env, log);
splash.show();
assert.equal(window.options.webPreferences.sandbox, true);
assert.match(decodeURIComponent(window.url), /data:image\/png;base64,bG9nbw==/);
assert.match(decodeURIComponent(window.url), /Content-Security-Policy/);
window.events['ready-to-show']();
assert.equal(window.shown, true);
splash.close();
splash.close();
assert.equal(window.destroyed, true);
assert.equal(timerCleared, true);
const original = window;
new Splash(env, log).show();
assert.equal(window, original, 'Splash only once per process');
console.log('Splash mock checks passed: guards, embedded logo, sandbox, ready event, cleanup, single startup');
