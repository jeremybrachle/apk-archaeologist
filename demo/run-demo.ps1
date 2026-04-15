@echo off
setlocal enabledelayedexpansion

:: ──────────────────────────────────────────────
:: APK Archeologist — Full Demo Pipeline
:: "Spared no expense."
:: ──────────────────────────────────────────────

set "SCRIPT_DIR=%~dp0"
set "ROOT_DIR=%SCRIPT_DIR%.."
set "GAME_DIR=%ROOT_DIR%\sample-game"
set "OUTPUT_DIR=%ROOT_DIR%\demo-output"
set "RECONSTRUCTED_DIR=%ROOT_DIR%\demo-reconstructed"

echo.
echo ══════════════════════════════════════════════════
echo   APK ARCHEOLOGIST — DEMO PIPELINE
echo ══════════════════════════════════════════════════
echo.
echo Welcome... to Jurassic Parse.
echo.

:: Step 0: Prerequisites
echo ══════════════════════════════════════════════════
echo   Step 0: Checking prerequisites
echo ══════════════════════════════════════════════════
echo.

where node >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js not found. Install Node.js 18+.
    exit /b 1
)
for /f "tokens=*" %%i in ('node --version') do echo Found Node.js %%i

where jadx >nul 2>&1
if errorlevel 1 (
    echo WARNING: JADX not found — decompilation will be skipped.
    set "HAS_JADX=false"
) else (
    echo Found JADX
    set "HAS_JADX=true"
)

:: Step 1: Install
echo.
echo ══════════════════════════════════════════════════
echo   Step 1: Installing dependencies
echo ══════════════════════════════════════════════════
echo.
cd /d "%ROOT_DIR%"
call npm install
echo Dependencies installed.

:: Step 2: Build
echo.
echo ══════════════════════════════════════════════════
echo   Step 2: Building Dino Dash
echo ══════════════════════════════════════════════════
echo.

set "APK_PATH=%GAME_DIR%\app\build\outputs\apk\debug\app-debug.apk"

if exist "%APK_PATH%" (
    echo APK already built.
) else (
    if exist "%GAME_DIR%\gradlew.bat" (
        echo Building with Gradle...
        cd /d "%GAME_DIR%"
        call gradlew.bat assembleDebug
        cd /d "%ROOT_DIR%"
    ) else (
        echo Gradle wrapper not found. Run setup.bat in sample-game first.
    )
)

:: Step 3: Analyze
echo.
echo ══════════════════════════════════════════════════
echo   Step 3: Analyzing the specimen
echo ══════════════════════════════════════════════════
echo.
echo Objects in mirror are closer than they appear.
echo.

cd /d "%ROOT_DIR%"

if exist "%APK_PATH%" (
    if "%HAS_JADX%"=="true" (
        call npx tsx src/index.ts analyze "%APK_PATH%" -o "%OUTPUT_DIR%" -v
    ) else (
        call npx tsx src/index.ts analyze "%APK_PATH%" -o "%OUTPUT_DIR%" --skip-decompile -v
    )
) else (
    echo No APK found. Build the game first.
    exit /b 0
)

:: Step 4: Reconstruct
echo.
echo ══════════════════════════════════════════════════
echo   Step 4: Reconstruction
echo ══════════════════════════════════════════════════
echo.
echo Filling in the sequence gaps with frog DNA...
echo.

if exist "%OUTPUT_DIR%\jadx" (
    call npx tsx src/index.ts reconstruct "%OUTPUT_DIR%" -o "%RECONSTRUCTED_DIR%"
) else if exist "%OUTPUT_DIR%\extracted" (
    call npx tsx src/index.ts reconstruct "%OUTPUT_DIR%" -o "%RECONSTRUCTED_DIR%"
) else (
    echo No decompiled sources found. Install JADX for the full experience.
)

:: Step 5: Compare
echo.
echo ══════════════════════════════════════════════════
echo   Step 5: Comparison
echo ══════════════════════════════════════════════════
echo.
echo Clever girl.
echo.

set "ORIGINAL_SRC=%GAME_DIR%\app\src\main\java"
set "RECONSTRUCTED_SRC=%RECONSTRUCTED_DIR%\src\main\java"

if exist "%RECONSTRUCTED_SRC%" (
    call npx tsx src/index.ts compare "%ORIGINAL_SRC%" "%RECONSTRUCTED_SRC%" -o "%ROOT_DIR%\comparison-report.md"
)

:: Done
echo.
echo ══════════════════════════════════════════════════
echo   Demo Complete
echo ══════════════════════════════════════════════════
echo.
echo Life, uh, finds a way.

endlocal
