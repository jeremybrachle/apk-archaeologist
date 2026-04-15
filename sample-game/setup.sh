#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

GRADLE_VERSION="8.7"
WRAPPER_JAR="gradle/wrapper/gradle-wrapper.jar"
WRAPPER_URL="https://services.gradle.org/distributions/gradle-${GRADLE_VERSION}-bin.zip"

echo "=== Dino Dash Build Setup ==="

# Check for Java
if ! command -v java &>/dev/null; then
    echo "ERROR: Java 17+ is required. Install it with:"
    echo "  Ubuntu/Debian: sudo apt install openjdk-17-jdk"
    echo "  macOS: brew install openjdk@17"
    echo "  Windows: winget install EclipseAdoptium.Temurin.17.JDK"
    exit 1
fi

JAVA_VERSION=$(java -version 2>&1 | head -1 | cut -d'"' -f2 | cut -d'.' -f1)
echo "Found Java $JAVA_VERSION"

# Check for Android SDK
if [ -z "${ANDROID_HOME:-}" ] && [ -z "${ANDROID_SDK_ROOT:-}" ]; then
    echo ""
    echo "WARNING: ANDROID_HOME / ANDROID_SDK_ROOT not set."
    echo "The build needs Android SDK with platform 34."
    echo ""
    echo "Quick setup:"
    echo "  1. Install Android Studio: https://developer.android.com/studio"
    echo "  2. Or install command-line tools:"
    echo "     sdkmanager 'platforms;android-34' 'build-tools;34.0.0'"
    echo "  3. Set ANDROID_HOME to your SDK path"
    echo ""

    # Try common locations
    for candidate in \
        "$HOME/Android/Sdk" \
        "$HOME/Library/Android/sdk" \
        "/usr/local/lib/android/sdk" \
        "$HOME/AppData/Local/Android/Sdk"; do
        if [ -d "$candidate" ]; then
            echo "Found SDK at: $candidate"
            export ANDROID_HOME="$candidate"
            break
        fi
    done

    if [ -z "${ANDROID_HOME:-}" ]; then
        echo "Could not auto-detect Android SDK. Set ANDROID_HOME and retry."
        exit 1
    fi
fi

SDK_PATH="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}"
echo "Using Android SDK: $SDK_PATH"

# Write local.properties
echo "sdk.dir=$SDK_PATH" > local.properties
echo "Wrote local.properties"

# Bootstrap Gradle wrapper if jar is missing
if [ ! -f "$WRAPPER_JAR" ]; then
    echo "Downloading Gradle wrapper..."
    mkdir -p gradle/wrapper

    if command -v gradle &>/dev/null; then
        gradle wrapper --gradle-version "$GRADLE_VERSION"
    else
        # Download gradle distribution and extract the wrapper jar
        TEMP_DIR=$(mktemp -d)
        echo "Downloading Gradle $GRADLE_VERSION..."
        curl -sL "$WRAPPER_URL" -o "$TEMP_DIR/gradle.zip"
        unzip -q "$TEMP_DIR/gradle.zip" -d "$TEMP_DIR"
        cp "$TEMP_DIR/gradle-$GRADLE_VERSION/lib/gradle-wrapper.jar" "$WRAPPER_JAR" 2>/dev/null || true

        # If that didn't work, use the gradle we just downloaded to create the wrapper
        if [ ! -f "$WRAPPER_JAR" ]; then
            "$TEMP_DIR/gradle-$GRADLE_VERSION/bin/gradle" wrapper --gradle-version "$GRADLE_VERSION"
        fi
        rm -rf "$TEMP_DIR"
    fi
fi

# Make gradlew executable
chmod +x gradlew 2>/dev/null || true

echo ""
echo "Setup complete! Build the APK with:"
echo "  cd sample-game"
echo "  ./gradlew assembleDebug"
echo ""
echo "The APK will be at:"
echo "  app/build/outputs/apk/debug/app-debug.apk"
