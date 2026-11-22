$ErrorActionPreference='Stop'
$ProgressPreference='SilentlyContinue'
$env:RUSTUP_HOME='C:\BuildTools\rustup';$env:CARGO_HOME='C:\BuildTools\cargo'
$env:PATH='C:\BuildTools\cargo\bin;C:\BuildTools\node-v22.23.4-win-x64;'+$env:PATH
$env:CARGO_BUILD_JOBS='2'
Set-Location C:\Build\wsm-gui-proof
& cmd.exe /c "npm.cmd ci > windows-build.log 2>&1"
if($LASTEXITCODE -ne 0){throw 'npm install failed'}
& cmd.exe /c "npm.cmd run tauri -- build --debug --no-bundle >> windows-build.log 2>&1"
Set-Content windows-build-status.txt $LASTEXITCODE
if($LASTEXITCODE -ne 0){throw 'native build failed'}
New-Item -ItemType Directory -Force portable | Out-Null
Copy-Item src-tauri\target\debug\wsm-gui-proof.exe portable\WSM-GUI-Proof.exe
Set-Content portable\README.txt 'WhackSmacker GUI proof 0.1.0-alpha.5. Requires Microsoft Edge WebView2 runtime. Uses a separate demo profile and does not access existing WSM progress. Unsigned alpha proof.'
Compress-Archive portable\* wsm-gui-0.1.0-alpha.5-windows-x64.zip -Force
