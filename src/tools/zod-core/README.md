ZOD Core — Context-Aware Cognitive Kernel

CLI examples:

```bash
# Via MCP CLI (stdio/http already running)
zod-mcp --http &

# Call as tool inside MCP chat: 
# zod_core(action="handle", query:"Explain module", sessionId:"s1", projectPath:"/path")

# Programmatic
node -e "import('./dist/index.mjs').then(m=>m.handle&&m.handle({query:'Explain',intent:'explain'},{sessionId:'s',projectPath:process.cwd()})).then(console.log)"
```

