# Нативное Android-приложение

Полноценное Android-приложение, которое запускается на телефоне
**без интернета, без Node.js и без сервера**.

Внутри — встроенный HTTP-сервер NanoHTTPD, который подаёт статику
(доска, движок Stockfish) и все API (задачи, дебюты) локально.

## Быстрый старт

### 1. Требования

- Android Studio (рекомендуется) или Gradle + Android SDK 34
- Java 17+
- Android-телефон с Android 5+ (API 21)
- Исходники проекта (см. основной README)

### 2. Подготовка данных

Перед сборкой убедитесь, что в корне проекта есть файлы:

| Файл | Размер | Зачем |
|---|---|---|
| `openings.json` | ~3.9 MB | 366 дебютных вариаций |
| `puzzles.json` | ~11 MB | 80 000 тактических задач |

Если их нет — запустите подготовку (см. основной README:
«Тактические задачи (Lichess)» и «Дебюты (обучение)»).

### 3. Сборка APK

```bash
cd android
bash build-apk.sh
```

Скрипт скопирует файлы из `public/`, `openings.json`, `puzzles.json`
в ресурсы Android-проекта и соберёт release APK.

Готовый APK: `android/app/build/outputs/apk/release/app-release.apk`

**Или через Android Studio:**
1. Откройте папку `android/` как проект
2. Дождитесь синхронизации Gradle
3. `Build → Build Bundle(s) / APK(s) → Build APK(s)`

### 4. Установка на телефон

```bash
adb install android/app/build/outputs/apk/release/app-release.apk
```

Или скиньте APK на телефон и откройте файловым менеджером
(потребуется разрешить установку из неизвестных источников).

## Как это работает

```
┌──────────────────────────────────────────┐
│              MainActivity                │
│  ┌──────────┐       ┌────────────────┐   │
│  │  WebView  │◄──────│   Server.java  │   │
│  │           │ HTTP  │ (NanoHTTPD)    │   │
│  │ app.js    │◄──────│                │   │
│  │ stockfish │       │ /api/openings  │   │
│  │ index.html│       │ /api/puzzles   │   │
│  │           │       │ /api/puzzle-   │   │
│  │           │       │   meta         │   │
│  │           │       │ статика (css,  │   │
│  │           │       │ js, png, svg)  │   │
│  └──────────┘       └────────────────┘   │
└──────────────────────────────────────────┘
         │                         ▲
         │          загружает       │
         ▼                         │
  assets/public/             assets/puzzles.json
  все web-файлы              assets/openings.json
```

1. При запуске `Server.java` читает `puzzles.json` и `openings.json`
   из папки assets и запускает HTTP-сервер на `127.0.0.1:8080`
2. `MainActivity` открывает WebView, загружает `http://127.0.0.1:8080/`
3. Весь код (`app.js`) работает без изменений — он обращается
   к тем же API-эндпоинтам, что и в браузерной версии
4. Stockfish работает в WebView как Web Worker (точно так же, как
   в браузере)

## Обновление данных

Чтобы обновить задачи или дебюты в уже собранном APK:

1. Обновите `puzzles.json` и/или `openings.json` в корне проекта
2. Перезапустите `bash build-apk.sh`
3. Установите новый APK поверх старого

## Подпись релизной версии

Для публикации или расшаривания APK подпишите его:

```bash
cd android
keytool -genkey -v -keystore release.keystore -alias cosmochess \
  -keyalg RSA -keysize 2048 -validity 10000
./gradlew assembleRelease \
  -Pandroid.injected.signing.store.file=release.keystore \
  -Pandroid.injected.signing.store.password=<password> \
  -Pandroid.injected.signing.key.alias=cosmochess \
  -Pandroid.injected.signing.key.password=<password>
```

Или настройте подпись в `android/app/build.gradle` (см. документацию
Android).

## Структура

```
android/
├── build.gradle                 — корневой Gradle-файл
├── settings.gradle              — настройки проекта
├── gradle.properties            — системные свойства
├── build-apk.sh                 — скрипт сборки APK
├── gradle/wrapper/
│   └── gradle-wrapper.properties
└── app/
    ├── build.gradle             — конфигурация модуля (зависимости, SDK)
    └── src/main/
        ├── AndroidManifest.xml  — разрешения, activity
        ├── java/com/cosmochess/app/
        │   ├── MainActivity.java  — WebView + вызов сервера
        │   └── Server.java        — NanoHTTPD (все API + статика)
        └── res/
            ├── layout/activity_main.xml  — разметка (WebView на весь экран)
            ├── values/styles.xml         — тёмная тема
            └── xml/network_security_config.xml
```

## Возможные проблемы

**Ошибка `CLEARTEXT communication not permitted`**  
Убедитесь, что `network_security_config.xml` настроен и указан
в манифесте: `android:networkSecurityConfig="@xml/network_security_config"`.

**Ошибка `java.io.IOException: Too many open files`**  
Уменьшите количество задач в `preprocess-puzzles.js`
(переменная `MAX_PUZZLES`, сейчас 80 000).

**WebView показывает белый экран**  
Убедитесь, что копирование файлов сработало:
`ls android/app/src/main/assets/public/index.html`. Если файла нет —
запустите `bash build-apk.sh`.

## Требования к версиям

| Компонент | Версия |
|---|---|
| Android SDK | 34 |
| Min SDK | 21 (Android 5.0) |
| Java | 17 |
| Gradle | 8.5 |
| Android Gradle Plugin | 8.2.0 |
