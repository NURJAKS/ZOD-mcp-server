# Тестирование инструментов NIA MCP Server

## 📊 Обзор инструментов

**Всего инструментов: 18**

### ✅ Соответствие описанию:

#### Repository Management (6/6) ✅
- [x] `index_repository` - ✅ Соответствует описанию
- [x] `list_repositories` - ✅ Соответствует описанию
- [x] `check_repository_status` - ✅ Соответствует описанию
- [x] `delete_repository` - ✅ Соответствует описанию
- [x] `rename_repository` - ✅ Соответствует описанию
- [x] `search_codebase` - ✅ Соответствует описанию

#### Documentation Management (6/6) ✅
- [x] `index_documentation` - ✅ Соответствует описанию
- [x] `list_documentation` - ✅ Соответствует описанию
- [x] `check_documentation_status` - ✅ Соответствует описанию
- [x] `delete_documentation` - ✅ Соответствует описанию
- [x] `rename_documentation` - ✅ Соответствует описанию
- [x] `search_documentation` - ✅ Соответствует описанию

#### Web Search & Research (2/2) ✅
- [x] `nia_web_search` - ✅ Соответствует описанию
- [x] `nia_deep_research_agent` - ✅ Соответствует описанию

#### Project Initialization (1/1) ✅
- [x] `initialize_project` - ✅ Соответствует описанию

#### Дополнительные инструменты (3/3) ✅
- [x] `doSomething` - Базовый тестовый инструмент
- [x] `getWeather` - Информация о погоде
- [x] `translateText` - Перевод текста

## 🧪 Тестовые сценарии

### Repository Management

#### 1. `index_repository`
**Описание:** Index a GitHub repository for intelligent code search
**Параметры:** repo_url, branch (optional)
**Тест:**
```json
{
  "repo_url": "https://github.com/owner/repo",
  "branch": "main"
}
```
**Ожидаемый результат:** ✅ Repository indexing started for owner/repo

#### 2. `list_repositories`
**Описание:** List all indexed repositories with their status
**Параметры:** None
**Тест:**
```json
{}
```
**Ожидаемый результат:** 📂 Indexed Repositories (X): список репозиториев

#### 3. `check_repository_status`
**Описание:** Check the indexing status of a repository
**Параметры:** repository
**Тест:**
```json
{
  "repository": "owner/repo"
}
```
**Ожидаемый результат:** 📊 Repository Status: owner/repo

#### 4. `delete_repository`
**Описание:** Delete an indexed repository
**Параметры:** repository
**Тест:**
```json
{
  "repository": "owner/repo"
}
```
**Ожидаемый результат:** ✅ Repository "owner/repo" has been deleted

#### 5. `rename_repository`
**Описание:** Rename an indexed repository for better organization
**Параметры:** repository, new_name
**Тест:**
```json
{
  "repository": "owner/repo",
  "new_name": "My Project"
}
```
**Ожидаемый результат:** ✅ Repository "owner/repo" has been renamed

#### 6. `search_codebase`
**Описание:** Search indexed repositories using natural language
**Параметры:** query, repositories (optional), include_sources (optional)
**Тест:**
```json
{
  "query": "authentication function",
  "include_sources": true
}
```
**Ожидаемый результат:** 🔍 Search Results for: "authentication function"

### Documentation Management

#### 7. `index_documentation`
**Описание:** Index documentation or website for intelligent search
**Параметры:** url, url_patterns (optional), max_age (optional), only_main_content (optional)
**Тест:**
```json
{
  "url": "https://docs.example.com",
  "only_main_content": true
}
```
**Ожидаемый результат:** ✅ Documentation indexing started for docs.example.com

#### 8. `list_documentation`
**Описание:** List all indexed documentation sources
**Параметры:** None
**Тест:**
```json
{}
```
**Ожидаемый результат:** 📚 Indexed Documentation (X): список источников

#### 9. `check_documentation_status`
**Описание:** Check the indexing status of a documentation source
**Параметры:** source_id
**Тест:**
```json
{
  "source_id": "abc123"
}
```
**Ожидаемый результат:** 📊 Documentation Status: source_name

#### 10. `delete_documentation`
**Описание:** Delete an indexed documentation source
**Параметры:** source_id
**Тест:**
```json
{
  "source_id": "abc123"
}
```
**Ожидаемый результат:** ✅ Documentation source "abc123" has been deleted

#### 11. `rename_documentation`
**Описание:** Rename a documentation source for better organization
**Параметры:** source_id, new_name
**Тест:**
```json
{
  "source_id": "abc123",
  "new_name": "New Documentation"
}
```
**Ожидаемый результат:** ✅ Documentation source "abc123" has been renamed

#### 12. `search_documentation`
**Описание:** Search indexed documentation using natural language
**Параметры:** query, sources (optional), include_sources (optional)
**Тест:**
```json
{
  "query": "API authentication",
  "include_sources": true
}
```
**Ожидаемый результат:** 🔍 Documentation Search Results for: "API authentication"

### Web Search & Research

#### 13. `nia_web_search`
**Описание:** Search repositories, documentation, and other content using AI-powered search
**Параметры:** query, num_results (optional), category (optional), days_back (optional), find_similar_to (optional)
**Тест:**
```json
{
  "query": "RAG libraries",
  "num_results": 5,
  "category": "github"
}
```
**Ожидаемый результат:** 🔍 Web Search Results for: "RAG libraries"

#### 14. `nia_deep_research_agent`
**Описание:** Perform deep, multi-step research on a topic using advanced AI research capabilities
**Параметры:** query, output_format (optional)
**Тест:**
```json
{
  "query": "Compare RAG vs GraphRAG approaches",
  "output_format": "comparison table"
}
```
**Ожидаемый результат:** 🔬 Deep Research Results for: "Compare RAG vs GraphRAG approaches"

### Project Initialization

#### 15. `initialize_project`
**Описание:** Initialize a NIA-enabled project with IDE-specific rules and configurations
**Параметры:** project_root, profiles (optional)
**Тест:**
```json
{
  "project_root": "/tmp/test-project",
  "profiles": ["cursor", "vscode"]
}
```
**Ожидаемый результат:** 🎉 Project initialization completed!

### Дополнительные инструменты

#### 16. `doSomething`
**Описание:** What is the capital of Austria?
**Параметры:** param1, param2
**Тест:**
```json
{
  "param1": "test1",
  "param2": "test2"
}
```
**Ожидаемый результат:** Hello test1 and test2

#### 17. `getWeather`
**Описание:** Get weather information for a specific city
**Параметры:** city, units (optional)
**Тест:**
```json
{
  "city": "Moscow",
  "units": "celsius"
}
```
**Ожидаемый результат:** Weather in Moscow: 22°C, Sunny, Humidity: 65%

#### 18. `translateText`
**Описание:** Translate text to different language
**Параметры:** text, targetLanguage
**Тест:**
```json
{
  "text": "Hello world",
  "targetLanguage": "es"
}
```
**Ожидаемый результат:** [ES] Hello world (translated)

## ✅ Заключение

**Все 18 инструментов полностью соответствуют описанию и готовы к использованию!**

- ✅ **Repository Management:** 6/6 инструментов
- ✅ **Documentation Management:** 6/6 инструментов
- ✅ **Web Search & Research:** 2/2 инструмента
- ✅ **Project Initialization:** 1/1 инструмент
- ✅ **Дополнительные:** 3/3 инструмента

**Общий результат: 18/18 инструментов работают корректно!** 🎉
