$ErrorActionPreference = 'Continue'

# Open Codex desktop.
Start-Process explorer.exe -ArgumentList 'shell:AppsFolder\OpenAI.Codex_2p2nqsd0c76g0!App'

# Open Claude Desktop as an optional reviewer.
Start-Process explorer.exe -ArgumentList 'shell:AppsFolder\Claude_pzs8sxrjxfjjc!Claude'

# Open Antigravity CLI in its own PowerShell window.
$agy = Join-Path $env:LOCALAPPDATA 'agy\bin\agy.exe'
$workspace = Join-Path $env:USERPROFILE 'Documents\Codex\2026-11-02\pued\work\ias'
if (Test-Path -LiteralPath $agy) {
  Start-Process powershell.exe -ArgumentList @('-NoExit', '-Command', "Set-Location -LiteralPath '$workspace'; & '$agy'")
} else {
  [System.Windows.Forms.MessageBox]::Show('No se encontró Antigravity CLI en ' + $agy, 'Codex + Gemini Team')
}
