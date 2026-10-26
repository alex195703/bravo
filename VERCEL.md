# Публикация сети «Браво» в интернете (Vercel)

После публикации у игры будет своя ссылка вида `https://имя.vercel.app` —
её можно открыть с телефона и отправить друзьям. Подробно с картинками —
в методичке «Проект „Сапёр"», глава 7: там тот же процесс.

## Способ 1: через Vercel CLI (самый быстрый, без GitHub)

1. В терминале, в папке проекта:
   ```powershell
   npm install -g vercel
   vercel login
   ```
   Браузер откроет страницу входа — зарегистрируйся (email или GitHub).
2. Запуск публикации:
   ```powershell
   vercel --prod
   ```
3. Отвечай на вопросы:
   - Set up and deploy? → **Y**
   - Which scope? → свой аккаунт (Enter)
   - Link to existing project? → **N**
   - What's your project's name? → `socionika` (Enter)
   - In which directory is your code? → `./` (Enter)
   - Остальное Vercel определит сам (Next.js) — жми Enter.
4. Через минуту в терминале появится ссылка вида `https://socionika-xxxx.vercel.app` 🎉

Обновлять сайт после правок кода: снова `vercel --prod` в папке проекта.

## Способ 2: через GitHub (классический)

1. Создай аккаунты на github.com и vercel.com (Vercel умеет входить через GitHub).
2. Создай пустой репозиторий `socionika` на GitHub.
3. В папке проекта:
   ```powershell
   git init
   git add .
   git commit -m "Тренажёр по соционике"
   git remote add origin https://github.com/ТВОЙ_ЛОГИН/socionika.git
   git push -u origin main
   ```
4. На vercel.com: **Add New → Project** → выбери репозиторий `socionika` → **Deploy**.
5. Vercel сам соберёт проект: настройки Next.js он узнаёт из `package.json`.

После этого каждый `git push` в репозиторий = автоматическое обновление сайта.

## Частые вопросы

- **Сколько стоит?** Хобби-проекты на Vercel бесплатны (достаточно для тренировок).
- **Нужна ли база данных?** Нет: тренажёр работает целиком в браузере, рекорды — в localStorage.
- **Ошибка при сборке?** Скопируй текст ошибки из панели Vercel и разберись с помощью ИИ — это часть обучения.
