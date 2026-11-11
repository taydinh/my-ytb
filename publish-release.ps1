param(
    [Parameter(Mandatory = $true)][ValidatePattern('^\d+\.\d+\.\d+$')][string]$Version,
    [string]$BaseUrl = 'https://timeclock.maskermedia.com',
    [string]$MinimumVersion = '',
    [switch]$Mandatory,
    [string[]]$ReleaseNotes = @('Thêm tính năng tự cập nhật Yêu Từ Pé.')
)
$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$versionDirectory = Join-Path $root "publish\release-$Version"
$buildDirectory = Join-Path $versionDirectory 'build'
$packageDirectory = Join-Path $versionDirectory 'package'
$releaseDirectory = Join-Path $versionDirectory 'upload\win-x64'
$packageName = "YTP-$Version-win-x64.zip"
$packagePath = Join-Path $releaseDirectory $packageName
if (Test-Path -LiteralPath $versionDirectory) { throw "Release $Version already exists: $versionDirectory" }
if ($MinimumVersion -and $MinimumVersion -notmatch '^\d+\.\d+\.\d+$') { throw 'MinimumVersion is invalid.' }
New-Item -ItemType Directory -Path $releaseDirectory, (Join-Path $packageDirectory 'portable') -Force | Out-Null
Push-Location $root
try {
    & npx.cmd --no-install electron-builder --win portable --x64 --config.compression=store "--config.directories.output=$buildDirectory" "--config.extraMetadata.version=$Version" '--config.portable.artifactName=YTP-portable.exe' --publish never
    if ($LASTEXITCODE -ne 0) { throw "electron-builder failed: $LASTEXITCODE" }
    $appDirectory = Join-Path $buildDirectory 'win-unpacked'
    $publishedVersion = (Get-Item -LiteralPath (Join-Path $appDirectory 'Yêu Từ Pé.exe')).VersionInfo.ProductVersion
    if ($publishedVersion -notin @($Version, "$Version.0")) { throw "Published version is $publishedVersion; expected $Version." }
    Copy-Item -LiteralPath $appDirectory -Destination (Join-Path $packageDirectory 'app') -Recurse
    Copy-Item -LiteralPath (Join-Path $buildDirectory 'YTP-portable.exe') -Destination (Join-Path $packageDirectory 'portable\YTP.exe')
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    [IO.Compression.ZipFile]::CreateFromDirectory($packageDirectory, $packagePath, [IO.Compression.CompressionLevel]::Optimal, $false)
    if (-not $MinimumVersion) { $MinimumVersion = $Version }
    $manifest = [ordered]@{
        version = $Version
        minimumVersion = $MinimumVersion
        mandatory = [bool]$Mandatory
        downloadUrl = "$($BaseUrl.TrimEnd('/'))/updates/ytp/win-x64/$packageName"
        sha256 = (Get-FileHash -LiteralPath $packagePath -Algorithm SHA256).Hash
        size = (Get-Item -LiteralPath $packagePath).Length
        publishedAtUtc = [DateTime]::UtcNow.ToString('O')
        releaseNotes = $ReleaseNotes
    }
    [IO.File]::WriteAllText((Join-Path $releaseDirectory 'latest.json'), ($manifest | ConvertTo-Json -Depth 4), [Text.UTF8Encoding]::new($false))
    Write-Host "Release ready: $releaseDirectory"
    Write-Host "Upload $packageName first, then latest.json to /updates/ytp/win-x64/."
} finally { Pop-Location }
