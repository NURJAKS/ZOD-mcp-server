#!/usr/bin/env node

import { spawn } from 'child_process';

async function simpleTest() {
  console.log('🧪 Simple Project Tools Test\n');
  
  try {
    console.log('📋 Testing project indexing...');
    const result = await runCommand('node', ['dist/index.mjs', 'project_tools', 'index']);
    console.log('✅ Index test passed');
    console.log('📊 Output preview:');
    console.log(result.substring(0, 500));
    console.log('...');
  } catch (error) {
    console.log('❌ Index test failed:', error.message);
  }
  
  console.log('\n🎉 Test completed!');
}

function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'pipe',
      cwd: process.cwd(),
      timeout: 30000
    });
    
    let output = '';
    let error = '';
    
    child.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    child.stderr.on('data', (data) => {
      error += data.toString();
    });
    
    child.on('close', (code) => {
      if (code === 0) {
        resolve(output);
      } else {
        reject(new Error(`Command failed with code ${code}: ${error}`));
      }
    });
    
    child.on('error', (error) => {
      reject(new Error(`Command execution failed: ${error.message}`));
    });
  });
}

simpleTest().catch(console.error); 