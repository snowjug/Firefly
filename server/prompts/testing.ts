// Test helper: builds real customer-generation contexts by running trainee lines through the real
// engine pipeline, so prompt tests exercise genuine state, discovery and curveball results rather
// than hand-built objects. It lives with the engine's other test fixtures.
export { captureContexts, type ScriptedLine } from '../engine/testing.ts';
