# Настройка .env файла для NIA MCP Server

## 📁 Расположение файла
```
/home/nurbekk/mcp-starter/.env
```

## 🔧 Содержимое .env файла

```env
# GitHub API Configuration
GITHUB_TOKEN=your_github_token_here

# OpenRouter Configuration (для семантического поиска)
OPENROUTER_API_KEY=your_openrouter_api_key_here

# Qdrant Vector Database
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=your_qdrant_api_key_here

# Redis Cache
REDIS_URL=redis://localhost:6379

# Database
DATABASE_URL=sqlite://./data/nia.db

# Web Search APIs
SERPER_API_KEY=your_serper_api_key_here
SERPAPI_KEY=your_serpapi_key_here

# Rate Limiting
GITHUB_RATE_LIMIT=5000
OPENROUTER_RATE_LIMIT=100

# Indexing Settings
MAX_FILE_SIZE=1024000
MAX_REPOSITORY_SIZE=100000000
INDEXING_TIMEOUT=300000
```

## 🔑 Получение API ключей

### 1. GitHub Token
```bash
# 1. Перейдите на https://github.com/settings/tokens
# 2. Нажмите "Generate new token (classic)"
# 3. Выберите scopes:
#    - repo (для доступа к репозиториям)
#    - read:org (для организаций)
# 4. Скопируйте токен в GITHUB_TOKEN
```

### 2. OpenRouter API Key
```bash
# 1. Зарегистрируйтесь на https://openrouter.ai
# 2. Перейдите в API Keys
# 3. Создайте новый ключ
# 4. Скопируйте в OPENROUTER_API_KEY
```

### 3. Serper API Key (опционально)
```bash
# 1. Зарегистрируйтесь на https://serper.dev
# 2. Получите API ключ
# 3. Скопируйте в SERPER_API_KEY
```

## 📋 Пошаговая настройка

### Шаг 1: Откройте .env файл
```bash
nano .env
# или
code .env
```

### Шаг 2: Замените placeholder значения
```env
# Замените эти строки на реальные ключи:
GITHUB_TOKEN=ghp_your_actual_github_token_here
OPENROUTER_API_KEY=sk-or-v1_your_actual_openrouter_key_here
SERPER_API_KEY=your_actual_serper_key_here
```

### Шаг 3: Сохраните файл
```bash
# В nano: Ctrl+X, затем Y, затем Enter
# В VS Code: Ctrl+S
```

## 🔒 Безопасность

### ✅ Правильно
- `.env` файл добавлен в `.gitignore`
- Ключи хранятся локально
- Никогда не коммитятся в git

### ❌ Неправильно
- Не публикуйте ключи в репозитории
- Не делитесь .env файлом
- Не используйте один ключ для всех

## 🧪 Проверка настройки

### Тест 1: Проверка переменных
```bash
node test-real-functionality.js
```

### Тест 2: Проверка сборки
```bash
npm run build
```

### Тест 3: Запуск сервера
```bash
npm run dev
```

## 📊 Статус API ключей

| API | Статус | Обязательный | Описание |
|-----|--------|--------------|----------|
| **GitHub** | 🔑 Требуется | ✅ Да | Индексация репозиториев |
| **OpenRouter** | 🔑 Требуется | ✅ Да | Семантический поиск |
| **Serper** | 🔑 Опционально | ❌ Нет | Веб-поиск (есть fallback) |
| **Qdrant** | ⚙️ Не используется | ❌ Нет | Векторный поиск (будущее) |
| **Redis** | ⚙️ Не используется | ❌ Нет | Кэширование (будущее) |

## 🚨 Устранение проблем

### "GitHub token not configured"
```bash
# 1. Проверьте GITHUB_TOKEN в .env
# 2. Убедитесь что токен имеет права repo
# 3. Проверьте что токен не истек
```

### "OpenRouter API key not configured"
```bash
# 1. Проверьте OPENROUTER_API_KEY в .env
# 2. Убедитесь что ключ активен на openrouter.ai
# 3. Проверьте лимиты использования
```

### "Serper API key not configured"
```bash
# Это нормально - веб-поиск будет использовать mock данные
# Для реального поиска получите ключ на serper.dev
```

## 📝 Пример рабочего .env файла

```env
# GitHub API Configuration
GITHUB_TOKEN=ghp_1234567890abcdef1234567890abcdef12345678

# OpenRouter Configuration (для семантического поиска)
OPENROUTER_API_KEY=sk-or-v1_1234567890abcdef1234567890abcdef12345678

# Qdrant Vector Database
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=your_qdrant_api_key_here

# Redis Cache
REDIS_URL=redis://localhost:6379

# Database
DATABASE_URL=sqlite://./data/nia.db

# Web Search APIs
SERPER_API_KEY=sk_1234567890abcdef1234567890abcdef12345678
SERPAPI_KEY=your_serpapi_key_here

# Rate Limiting
GITHUB_RATE_LIMIT=5000
OPENROUTER_RATE_LIMIT=100

# Indexing Settings
MAX_FILE_SIZE=1024000
MAX_REPOSITORY_SIZE=100000000
INDEXING_TIMEOUT=300000
```

## 🎯 Готово!

После настройки .env файла все инструменты будут работать с реальными API:

- ✅ **Repository Management** - GitHub API
- ✅ **Documentation Management** - Веб-скрапинг
- ✅ **Web Search** - Serper API (или mock)
- ✅ **Deep Research** - OpenRouter DeepSeek Free
- ✅ **Project Initialization** - Локальные файлы 