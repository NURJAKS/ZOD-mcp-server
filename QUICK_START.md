# 🚀 Быстрый старт NIA MCP Server

## ✅ **Все настроено и готово к работе!**

### **Статус компонентов:**
- ✅ **GitHub API** - настроен
- ✅ **OpenRouter API** - настроен  
- ✅ **Qdrant** - запущен на http://localhost:6333
- ✅ **SQLite** - база данных готова
- ✅ **Проект** - собран и запущен

---

## 🎯 **Как использовать инструменты**

### **1. Индексация репозитория**
```javascript
// Индексируем GitHub репозиторий
await index_repository({
  repo_url: "https://github.com/owner/repo",
  branch: "main"
})

// Результат: Файлы будут проиндексированы в SQLite + Qdrant
```

### **2. Поиск по коду с пониманием контекста**
```javascript
// Поиск функций аутентификации
await search_codebase({
  query: "authentication function",
  repositories: ["owner/repo"]
})

// Поиск по архитектуре
await search_codebase({
  query: "database connection",
  repositories: ["owner/repo"]
})
```

### **3. Индексация документации**
```javascript
// Индексируем документацию
await index_documentation({
  url: "https://docs.example.com",
  url_patterns: ["/docs/", "/guide/"]
})
```

### **4. Поиск по документации**
```javascript
// Поиск по документации
await search_documentation({
  query: "API setup guide",
  sources: ["docs.example.com"]
})
```

### **5. Веб-поиск**
```javascript
// Поиск в интернете
await nia_web_search({
  query: "React hooks best practices",
  num_results: 5
})
```

### **6. Глубокое исследование**
```javascript
// Многоэтапное исследование
await nia_deep_research_agent({
  query: "State management in React",
  output_format: "comparison table"
})
```

---

## 📊 **Мониторинг и управление**

### **Проверка статуса репозиториев**
```javascript
await list_repositories()
await check_repository_status("repository_id")
```

### **Проверка статуса документации**
```javascript
await list_documentation()
await check_documentation_status("documentation_id")
```

### **Удаление данных**
```javascript
await delete_repository("owner/repo")
await delete_documentation("documentation_id")
```

---

## 🔍 **Примеры реального использования**

### **Сценарий 1: Анализ проекта**
```javascript
// 1. Индексируем проект
await index_repository({
  repo_url: "https://github.com/facebook/react",
  branch: "main"
})

// 2. Ищем компоненты
await search_codebase({
  query: "functional component",
  repositories: ["facebook/react"]
})

// 3. Ищем хуки
await search_codebase({
  query: "useState useEffect",
  repositories: ["facebook/react"]
})
```

### **Сценарий 2: Исследование технологии**
```javascript
// 1. Веб-поиск
await nia_web_search({
  query: "TypeScript vs JavaScript 2024",
  num_results: 10
})

// 2. Глубокое исследование
await nia_deep_research_agent({
  query: "Microservices architecture patterns",
  output_format: "pros and cons list"
})
```

### **Сценарий 3: Документация**
```javascript
// 1. Индексируем документацию
await index_documentation({
  url: "https://react.dev",
  url_patterns: ["/learn/", "/reference/"]
})

// 2. Ищем информацию
await search_documentation({
  query: "useEffect cleanup",
  sources: ["react.dev"]
})
```

---

## 🛠️ **Управление сервером**

### **Запуск сервера**
```bash
npm run dev
```

### **Остановка сервера**
```bash
# Ctrl+C в терминале
```

### **Проверка статуса**
```bash
# Проверка Qdrant
curl http://localhost:6333/collections

# Проверка проекта
node test-real-functionality.js
```

---

## 📈 **Что происходит при индексации**

### **Repository Indexing:**
1. **GitHub API** - получает файлы
2. **SQLite** - сохраняет метаданные
3. **Qdrant** - создает embeddings
4. **OpenRouter** - генерирует векторы

### **Documentation Indexing:**
1. **Web Scraping** - получает страницы
2. **SQLite** - сохраняет контент
3. **Qdrant** - создает embeddings
4. **OpenRouter** - генерирует векторы

### **Search Process:**
1. **Текстовый поиск** - SQLite
2. **Векторный поиск** - Qdrant
3. **Семантический анализ** - OpenRouter
4. **Объединение результатов** - гибридный поиск

---

## 🎉 **Готово к использованию!**

**Все 15 инструментов работают с пониманием контекста:**

- ✅ **Repository Management** - 6 инструментов
- ✅ **Documentation Management** - 6 инструментов  
- ✅ **Web Search & Research** - 2 инструмента
- ✅ **Project Initialization** - 1 инструмент

**Начинайте использовать прямо сейчас!** 🚀 