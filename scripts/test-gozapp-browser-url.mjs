import assert from 'node:assert/strict';
import { validateGozappBrowserUrl } from '../src/vs/workbench/contrib/chat/common/gozappBrowserUrl.ts';
assert.equal(validateGozappBrowserUrl(' http://localhost:3000 '), 'http://localhost:3000/');
assert.equal(validateGozappBrowserUrl('http://[::1]:8080/test'), 'http://[::1]:8080/test');
assert.equal(validateGozappBrowserUrl('https://example.com/a?q=1#x'), 'https://example.com/a?q=1#x');
for (const url of ['', 'localhost:3000', 'javascript:alert(1)', 'file:///etc/passwd', 'https://user:secret@example.com', 'data:text/html,test']) {
    assert.throws(() => validateGozappBrowserUrl(url));
}
console.log('Browser URL validation passed');
