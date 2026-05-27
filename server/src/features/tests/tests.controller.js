const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { getTestCasesPath } = require('../../utils/fileHelpers');

exports.runTests = async (req, res) => {
  const { turma, studentId, questionNum, filePath, code } = req.body;
  if (!filePath || (!code && !fs.existsSync(filePath))) return res.status(400).json({ error: 'File not found' });

  const tp = getTestCasesPath(turma);
  const allCases = fs.existsSync(tp) ? JSON.parse(fs.readFileSync(tp, 'utf8')) : {};
  const cases = allCases[questionNum.toString().startsWith('q') ? questionNum : `q${questionNum}`];
  if (!cases || !cases.length) return res.status(400).json({ error: 'No test cases found' });

  const dir = path.dirname(filePath), originalFileName = path.basename(filePath);
  let fileNameToCompile = originalFileName, isTemporary = false;
  
  if (code) {
    fileNameToCompile = `${path.basename(originalFileName, path.extname(originalFileName))}_test_suite${path.extname(originalFileName)}`;
    fs.writeFileSync(path.join(dir, fileNameToCompile), code, 'utf8');
    isTemporary = true;
  }

  const exeName = `${path.basename(fileNameToCompile, '.cpp')}_run.exe`, exePath = path.join(dir, exeName);

  try {
    // Compile
    await new Promise((resolve, reject) => {
      const compile = spawn('g++', [fileNameToCompile, '-o', exeName], { cwd: dir, shell: true });
      let err = '';
      compile.stderr.on('data', d => err += d.toString());
      compile.on('close', c => {
        if (isTemporary) {
          try { fs.unlinkSync(path.join(dir, fileNameToCompile)); } catch(e) {}
        }
        c === 0 ? resolve() : reject(new Error(err));
      });
    });

    const results = [];
    for (const tc of cases) {
      const start = Date.now();
      const output = await new Promise((resolve) => {
        const child = spawn(process.platform === 'win32' ? exeName : `./${exeName}`, { cwd: dir, shell: true });
        let out = '', err = '';
        const timer = setTimeout(() => { child.kill(); resolve({ error: 'Timeout (2s)' }); }, 2000);
        
        child.stdin.write(tc.input + '\n');
        child.stdin.end();

        child.stdout.on('data', d => out += d.toString());
        child.stderr.on('data', d => err += d.toString());
        child.on('close', () => {
          clearTimeout(timer);
          resolve({ out: out.trim(), err: err.trim() });
        });
      });

      const duration = Date.now() - start;
      const passed = output.out === tc.output.trim();
      results.push({
        name: tc.name,
        input: tc.input,
        expected: tc.output,
        actual: output.out || output.error || output.err,
        passed,
        duration
      });
    }

    try { fs.unlinkSync(exePath); } catch(e) {}
    res.json({ success: true, results });
  } catch (err) {
    res.status(500).json({ error: 'Compilation failed', details: err.message });
  }
};
