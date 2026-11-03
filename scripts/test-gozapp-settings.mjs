import assert from 'node:assert/strict';
import { buildGozappModelGroup, isValidGozappModelId } from '../src/vs/workbench/contrib/chat/common/gozappModelConfig.ts';
const form = { name: 'Router', baseUrl: 'https://example.com/v1/', modelIds: 'model-a, model-b,model-a', apiType: 'chat-completions', inputTokens: 32000, outputTokens: 4096, toolCalling: true, vision: false };
assert.equal(isValidGozappModelId('kr/claude-sonnet-5.5'), true);
for (const id of ['', 'bad model', 'bad\tmodel', 'bad,model', 'x'.repeat(201)]) {
    assert.equal(isValidGozappModelId(id), false);
}
assert.equal(buildGozappModelGroup({ ...form, modelIds: 'kr/claude-sonnet-5.5' }).models[0].id, 'kr/claude-sonnet-5.5');
const group = buildGozappModelGroup(form);
assert.equal(group.vendor, 'customendpoint');
assert.equal(group.models.length, 2);
assert.equal(group.models[0].url, 'https://example.com/v1/chat/completions');
assert.equal(group.models[0].toolCalling, true);
assert.equal(buildGozappModelGroup({ ...form, baseUrl: group.models[0].url }).models[0].url, group.models[0].url);
assert.equal(buildGozappModelGroup({ ...form, apiType: 'messages' }).models[0].url, 'https://example.com/v1/messages');
assert.equal(buildGozappModelGroup({ ...form, baseUrl: 'http://localhost:11434/v1' }).models.length, 2);
for (const change of [{ baseUrl: 'http://example.com/v1' }, { baseUrl: 'https://key:secret@example.com' }, { baseUrl: 'file:///etc' }, { baseUrl: 'https://example.com/?key=x' }, { modelIds: '' }, { modelIds: 'bad model' }, { name: '' }, { inputTokens: NaN }, { outputTokens: -1 }, { apiType: 'unknown' }]) {
    assert.throws(() => buildGozappModelGroup({ ...form, ...change }));
}
const separateModels = [
    { id: 'model-small', input: 32000, output: 4096 },
    { id: 'model-large', input: 128000, output: 8192 },
].flatMap(m => buildGozappModelGroup({ ...form, modelIds: m.id, inputTokens: m.input, outputTokens: m.output }).models);
assert.deepEqual(separateModels.map(m => [m.id, m.maxInputTokens, m.maxOutputTokens]), [
    ['model-small', 32000, 4096], ['model-large', 128000, 8192],
]);
const mixedCapabilities = [false, true].flatMap(enabled => buildGozappModelGroup({ ...form,
    modelIds: enabled ? 'agent-model' : 'ask-model', toolCalling: enabled, vision: enabled,
}).models);
assert.deepEqual(mixedCapabilities.map(m => [m.toolCalling, m.vision]), [[false, false], [true, true]]);
console.log('Gozapp settings validation passed');
