$ErrorActionPreference = "Stop"

$repo = Split-Path -Parent $PSScriptRoot
$python = Join-Path $repo ".venv\Scripts\python.exe"
$git = "C:\Program Files\Git\cmd\git.exe"
$bundledNode = Join-Path $env:USERPROFILE ".cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
$node = if (Test-Path $bundledNode) { $bundledNode } else { (Get-Command node).Source }

Push-Location $repo
try {
  & $python -m py_compile app.py
  Get-ChildItem "static\js\*.js" | ForEach-Object {
    & $node --check $_.FullName
  }
  & $git diff --check
  Write-Output "checks=ok"
} finally {
  Pop-Location
}
