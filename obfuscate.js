const JavaScriptObfuscator = require('javascript-obfuscator');
const fs = require('fs');

const TARGET_FILES = [
    'auth/login.js',
    'common/backend_connection.js'
];

TARGET_FILES.forEach(filePath => {
    if (!fs.existsSync(filePath)) {
        console.warn(`⚠️  File not found, skipping: ${filePath}`);
        return;
    }

    try {
        const code = fs.readFileSync(filePath, 'utf8');
        const obfuscated = JavaScriptObfuscator.obfuscate(code, {
            compact: true,
            controlFlowFlattening: true,
            controlFlowFlatteningThreshold: 0.75,
            stringArray: true,
            stringArrayThreshold: 0.75,
            renameGlobals: false,
            reservedNames: ['showNotification', 'login']
        });
        fs.writeFileSync(filePath, obfuscated.getObfuscatedCode());
        console.log(`✅ Obfuscated: ${filePath}`);
    } catch (err) {
        console.error(`❌ Failed: ${filePath} — ${err.message}`);
    }
});

console.log('\nDone.');