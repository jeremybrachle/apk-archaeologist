@echo off
setlocal enabledelayedexpansion

echo === Dino Dash Build Setup ===

cd /d "%~dp0"

:: Check for Java
where java >nul 2>&1
if errorlevel 1 (
    echo ERROR: Java 17+ is required.
    echo Install: winget install EclipseAdoptium.Temurin.17.JDK
    exit /b 1
)

:: Check for Android SDK
if not defined ANDROID_HOME (
    if not defined ANDROID_SDK_ROOT (
        echo WARNING: ANDROID_HOME not set.

        :: Try common Windows locations
        if exist "%LOCALAPPDATA%\Android\Sdk" (
            set "ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk"
            echo Found SDK at: !ANDROID_HOME!
        ) else if exist "%USERPROFILE%\AppData\Local\Android\Sdk" (
            set "ANDROID_HOME=%USERPROFILE%\AppData\Local\Android\Sdk"
            echo Found SDK at: !ANDROID_HOME!
        ) else (
            echo Could not find Android SDK. Install Android Studio or set ANDROID_HOME.
            exit /b 1
        )
    ) else (
        set "ANDROID_HOME=%ANDROID_SDK_ROOT%"
    )
)

echo Using Android SDK: %ANDROID_HOME%

:: Write local.properties
echo sdk.dir=%ANDROID_HOME:\=/%> local.properties
echo Wrote local.properties

:: Check for Gradle wrapper jar
if not exist "gradle\wrapper\gradle-wrapper.jar" (
    echo Gradle wrapper jar not found.
    where gradle >nul 2>&1
    if not errorlevel 1 (
        echo Generating via installed Gradle...
        gradle wrapper --gradle-version 8.7
    ) else (
        echo Please install Gradle ^(https://gradle.org/install/^) and run:
        echo   gradle wrapper --gradle-version 8.7
        echo Then re-run this script.
        exit /b 1
    )
)

echo.
echo Setup complete! Build the APK with:
echo   cd sample-game
echo   gradlew.bat assembleDebug
echo.
echo The APK will be at:
echo   app\build\outputs\apk\debug\app-debug.apk

endlocal
