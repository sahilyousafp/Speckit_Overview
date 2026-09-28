// Spec Kit's template resolver parses preset.yml with PyYAML, using `python3` when that name is on
// PATH and `python` otherwise. Check the same interpreter so the warning matches what will fail.
import { findExecutable, run } from './exec.mjs';

export async function checkPyYaml() {
  const name = findExecutable('python3') ? 'python3' : findExecutable('python') ? 'python' : null;
  if (!name) {
    return { ok: false, message: 'No python3 or python found on PATH. Spec Kit presets need Python with PyYAML.' };
  }
  try {
    const { code } = await run(findExecutable(name), ['-c', 'import yaml'], { capture: true, input: '', timeoutMs: 30_000 });
    if (code === 0) return { ok: true };
  } catch {
    // Fall through to the warning.
  }
  return {
    ok: false,
    message:
      `PyYAML is not installed for \`${name}\`, which Spec Kit uses to resolve preset templates. ` +
      `Without it /speckit-plan, /speckit-tasks and /speckit-constitution report "PyYAML is required". Fix:\n` +
      `  ${name} -m pip install pyyaml`,
  };
}
