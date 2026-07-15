$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path

Start-Process dotnet -ArgumentList @('run', '--project', (Join-Path $root 'OrgSystem.API')) -WorkingDirectory $root
Start-Process npm.cmd -ArgumentList @('run', 'dev') -WorkingDirectory (Join-Path $root 'org-system-ui')

Write-Host 'Backend: http://localhost:5043' -ForegroundColor Green
Write-Host 'Frontend: http://localhost:5174' -ForegroundColor Green
Write-Host 'برای توقف، پنجره‌های backend و frontend را ببندید.'
