<#
.SYNOPSIS
    Links (or copies) the version-controlled HLAE cam_export.js snippet into the
    HLAE installation so CS2/HLAE picks up changes made in this repository.

.DESCRIPTION
    Creates a symbolic link at the HLAE snippets folder pointing back to
    hlae\cam-export.js in this repository. Creating a file symlink on Windows
    normally requires an elevated (Administrator) PowerShell session, or Developer
    Mode enabled (Settings > Update & Security > For developers).

    If a symlink cannot be created (e.g. no admin rights and Developer Mode is
    off), the script falls back to copying the file instead. Copies will not
    reflect future edits automatically - re-run this script after changes.

.PARAMETER HlaePath
    Path to the HLAE installation. Defaults to the standard 32-bit Program Files
    location.

.EXAMPLE
    ./scripts/link-hlae-snippet.ps1

.EXAMPLE
    ./scripts/link-hlae-snippet.ps1 -HlaePath "D:\Tools\HLAE"
#>

param(
    [string]$HlaePath = "$Env:ProgramFiles(x86)\HLAE"
)

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$source = Join-Path $repoRoot 'hlae\cam-export.js'
$snippetsDir = Join-Path $HlaePath 'resources\AfxHookSource2\snippets'
$target = Join-Path $snippetsDir 'cam-export.js'

if (-not (Test-Path $source)) {
    Write-Error "Source file not found: $source"
    exit 1
}

if (-not (Test-Path $snippetsDir)) {
    Write-Error "HLAE snippets folder not found: $snippetsDir. Pass -HlaePath if HLAE is installed elsewhere."
    exit 1
}

if (Test-Path $target) {
    $existingItem = Get-Item $target -Force
    if ($existingItem.LinkType -eq 'SymbolicLink' -and $existingItem.Target -eq $source) {
        Write-Host "Symlink already up to date: $target -> $source"
        exit 0
    }

    Write-Host "Existing file found at $target, backing it up to cam-export.js.bak"
    Copy-Item $target "$target.bak" -Force
    Remove-Item $target -Force
}

try {
    New-Item -ItemType SymbolicLink -Path $target -Target $source | Out-Null
    Write-Host "Created symlink: $target -> $source"
}
catch {
    Write-Warning "Could not create a symlink (requires admin rights or Developer Mode). Falling back to a copy."
    Write-Warning $_.Exception.Message
    Copy-Item $source $target -Force
    Write-Host "Copied $source -> $target (re-run this script after future edits)"
}
