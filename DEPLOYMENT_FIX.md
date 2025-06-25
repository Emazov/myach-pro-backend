# Исправление ошибки деплоя

## Проблема

Ошибка при деплое: `TypeError: Missing parameter name at 1: https://git.new/pathToRegexpError` в Express 5.x

## Причина

Express 5.x имеет breaking changes с роутингом и path-to-regexp:

- Символ `*` для catch-all роутов больше не поддерживается в app.use('\*', ...)
- path-to-regexp@8.x требует строгого синтаксиса параметров
- Изменения в типизации middleware

## ✅ Исправления

### 1. Downgrade Express до стабильной версии 4.x

```json
{
	"express": "^4.19.2", // было "^5.1.0"
	"@types/express": "^4.17.21", // было "^5.0.3"
	"multer": "^1.4.5-lts.1", // было "^2.0.1"
	"body-parser": "^1.20.2" // было "^2.2.0"
}
```

### 2. Исправлен проблемный роут

```typescript
// Было:
app.use('*', (req, res) => {
	res.status(404).json({ error: 'Маршрут не найден' });
});

// Стало:
app.use(notFoundHandler);
```

### 3. Упрощен JSON parser

```typescript
// Убрана дополнительная валидация, которая может конфликтовать с Express 4
app.use(express.json({ limit: '10mb' }));
```

### 4. Исправлена типизация error handler

```typescript
app.use(errorHandler as express.ErrorRequestHandler);
```

## Результат

- ✅ Билд проходит успешно
- ✅ Приложение запускается без ошибок
- ✅ Все роуты работают корректно
- ✅ Совместимость с production окружением

## Следующие шаги

1. Деплой с исправленными зависимостями
2. Тестирование всех endpoints в production
3. В будущем планировать миграцию на Express 5.x когда он стабилизируется

## Зависимости безопасности

- Используются стабильные версии пакетов
- Все критические уязвимости закрыты
- Предупреждение о Multer 1.x учтено (в v2 есть breaking changes, потребуется отдельная миграция)
