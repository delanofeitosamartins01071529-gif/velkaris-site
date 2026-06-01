$ErrorActionPreference = "Stop"

$repo = Split-Path -Parent $PSScriptRoot
$python = Join-Path $repo ".venv\Scripts\python.exe"

Get-Process python -ErrorAction SilentlyContinue |
  Where-Object { $_.Path -eq $python } |
  Stop-Process -Force

Start-Process -FilePath $python -ArgumentList "app.py" -WorkingDirectory $repo -WindowStyle Hidden | Out-Null
Start-Sleep -Seconds 3

$health = Invoke-WebRequest -UseBasicParsing "http://127.0.0.1:5000/healthz"
Write-Output ("health=" + $health.StatusCode)
Write-Output "url=http://127.0.0.1:5000/"
