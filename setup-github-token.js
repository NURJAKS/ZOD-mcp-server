#!/usr/bin/env node

import fs from 'fs'
import readline from 'readline'

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

async function setupGitHubToken() {
  console.log('🔑 GitHub Token Setup\n')
  console.log('To get your GitHub token:')
  console.log('1. Go to: https://github.com/settings/tokens')
  console.log('2. Click "Generate new token (classic)"')
  console.log('3. Name it: "NIA MCP Server"')
  console.log('4. Select permissions: repo, read:org, read:user, read:email')
  console.log('5. Generate and copy the token\n')

  const token = await new Promise((resolve) => {
    rl.question('Paste your GitHub token here: ', (answer) => {
      resolve(answer.trim())
    })
  })

  if (!token || token === 'your_github_token_here') {
    console.log('❌ No valid token provided')
    rl.close()
    return
  }

  // Read current .env file
  let envContent = fs.readFileSync('.env', 'utf8')
  
  // Replace the placeholder with the real token
  envContent = envContent.replace(
    /GITHUB_TOKEN=your_github_token_here/,
    `GITHUB_TOKEN=${token}`
  )
  
  // Write back to .env file
  fs.writeFileSync('.env', envContent)
  
  console.log('✅ GitHub token configured successfully!')
  console.log('🔒 Token saved to .env file')
  console.log('\nNow you can index repositories with higher rate limits!')
  
  rl.close()
}

setupGitHubToken().catch(console.error) 