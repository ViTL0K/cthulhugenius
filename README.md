# Поклик Ктулху · тест входу через Google

1. Розпакуй цей ZIP і завантаж його вміст у корінь нового приватного репозиторію GitHub. Файл `wrangler.jsonc` має бути видно одразу після відкриття репозиторію.
2. У Cloudflare відкрий **Workers & Pages → cthulhugenius → Settings → Builds** і під’єднай репозиторій. Залиш поле **Build command** порожнім. У **Deploy command** залиш `npx wrangler deploy`.
3. У Cloudflare відкрий **D1 → cthulhugenius-test → Console** і виконай SQL із файлу `schema.sql`. Він створює порожні тестові таблиці.
4. У Google Auth Platform створи клієнт OAuth типу **Web application**. У **Authorized redirect URIs** встав значення `GOOGLE_REDIRECT_URI` з `wrangler.jsonc`. Якщо застосунок Google має статус **Testing**, додай свій акаунт у **Audience → Test users**.
5. У налаштуваннях Worker додай `GOOGLE_CLIENT_ID` як змінну і `GOOGLE_CLIENT_SECRET` як секрет. Після збереження відкрий Worker через **Visit** і перевір вхід та вихід.

Цей Worker запускає лише тестову сторінку входу. Ігрові кімнати, листи, чати й матеріали ще не перенесені.
