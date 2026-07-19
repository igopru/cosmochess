#!/usr/bin/env bash
# Build Cosmochess Android APK
# Prerequisites: Android SDK, Java 17+, Node.js (for data)
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT="$(dirname "$DIR")"

echo "==> Copying web files into Android assets..."
ASSETS="$DIR/app/src/main/assets"
mkdir -p "$ASSETS/public"

# Copy public/ (excluding stockfish.js which is large, but we need it)
cp -r "$PROJECT/public/"* "$ASSETS/public/"
# Copy JSON data
cp "$PROJECT/openings.json" "$ASSETS/"
cp "$PROJECT/puzzles.json" "$ASSETS/"

echo "==> Setting up Gradle wrapper..."
if [ ! -f "$DIR/gradlew" ]; then
    cd "$DIR"
    gradle wrapper --gradle-version 8.5 2>/dev/null || true
    # If gradle not installed, download wrapper manually
    if [ ! -f "$DIR/gradlew" ]; then
        echo "Gradle not found. Downloading wrapper..."
        mkdir -p "$DIR/gradle/wrapper"
        cd "$DIR"
        curl -sL "https://services.gradle.org/distributions/gradle-8.5-bin.zip" -o /tmp/gradle.zip
        # Minimal wrapper – user needs to run with 'gradle wrapper' once
        echo "Please install Gradle or Android Studio, then run:"
        echo "  cd $DIR && gradle wrapper"
        exit 1
    fi
fi

echo "==> Building APK..."
cd "$DIR"
./gradlew assembleRelease

echo ""
echo "APK built: $DIR/app/build/outputs/apk/release/app-release.apk"
echo "Install with: adb install $DIR/app/build/outputs/apk/release/app-release.apk"
