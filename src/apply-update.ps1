param([Parameter(Mandatory = $true)][string]$ConfigPath)
$ErrorActionPreference = 'Stop'
$config = Get-Content -LiteralPath $ConfigPath -Raw -Encoding UTF8 | ConvertFrom-Json
$work = Split-Path -Parent $ConfigPath
$staging = Join-Path $work 'staging'
$backup = Join-Path $work 'backup'
$targetExe = [IO.Path]::GetFullPath($config.targetExecutable)
$targetRoot = Split-Path -Parent $targetExe
$copied = [Collections.Generic.List[string]]::new()
$script:form = $null
$script:allowClose = $false
$script:lastProgressWrite = [DateTime]::MinValue
$showProgress = $config.showProgress -ne $false

function Set-UpdateProgress([string]$Phase, [double]$Percent, [string]$Status, [switch]$Force) {
    $percentValue = [Math]::Max(0, [Math]::Min(100, [int]$Percent))
    if ($script:form) {
        $script:progressBar.Value = $percentValue
        $script:progressLabel.Text = "$percentValue%"
        $script:statusLabel.Text = $Status
        [Windows.Forms.Application]::DoEvents()
    }
    if ($Force -or ([DateTime]::UtcNow - $script:lastProgressWrite).TotalMilliseconds -ge 150) {
        $state = @{ phase = $Phase; percent = $percentValue; status = $Status } | ConvertTo-Json -Compress
        [IO.File]::WriteAllText((Join-Path $work 'progress.json'), $state, [Text.UTF8Encoding]::new($false))
        $script:lastProgressWrite = [DateTime]::UtcNow
    }
}
function Copy-UpdateStream($InputStream, $OutputStream, [string]$Phase, [double]$Start, [double]$Range, [long]$Offset, [long]$Total, [string]$Status) {
    $buffer = New-Object byte[] (1024 * 1024)
    [long]$received = 0
    while (($read = $InputStream.Read($buffer, 0, $buffer.Length)) -gt 0) {
        $OutputStream.Write($buffer, 0, $read)
        $received += $read
        Set-UpdateProgress $Phase ($Start + $Range * ($Offset + $received) / [Math]::Max(1, $Total)) $Status
    }
}
try {
    if ($showProgress) {
        Add-Type -AssemblyName System.Windows.Forms
        Add-Type -AssemblyName System.Drawing
        [Windows.Forms.Application]::EnableVisualStyles()
        $script:form = New-Object Windows.Forms.Form
        $script:form.Text = 'Cập nhật Yêu Từ Pé'
        $script:form.ClientSize = New-Object Drawing.Size(490, 245)
        $script:form.StartPosition = 'CenterScreen'
        $script:form.FormBorderStyle = 'FixedDialog'
        $script:form.MaximizeBox = $false
        $script:form.MinimizeBox = $false
        $script:form.ControlBox = $false
        $script:form.TopMost = $true
        $script:form.Font = New-Object Drawing.Font('Segoe UI', 10)
        $script:form.Add_FormClosing({ param($sender, $eventArgs) if (-not $script:allowClose) { $eventArgs.Cancel = $true } })
        $title = New-Object Windows.Forms.Label
        $title.Text = 'Đang cài đặt phiên bản mới'
        $title.SetBounds(24, 22, 440, 32)
        $title.Font = New-Object Drawing.Font('Segoe UI', 15, [Drawing.FontStyle]::Bold)
        $script:statusLabel = New-Object Windows.Forms.Label
        $script:statusLabel.SetBounds(24, 67, 440, 42)
        $script:progressLabel = New-Object Windows.Forms.Label
        $script:progressLabel.SetBounds(24, 117, 440, 24)
        $script:progressLabel.TextAlign = 'MiddleRight'
        $script:progressBar = New-Object Windows.Forms.ProgressBar
        $script:progressBar.SetBounds(24, 148, 440, 18)
        $hint = New-Object Windows.Forms.Label
        $hint.Text = 'Giữ nguyên cookie đăng nhập và danh sách yêu thích. Ứng dụng sẽ tự mở lại khi hoàn tất.'
        $hint.SetBounds(24, 183, 440, 47)
        $script:form.Controls.AddRange(@($title, $script:statusLabel, $script:progressLabel, $script:progressBar, $hint))
        $script:form.Show()
    }
    Set-UpdateProgress 'waiting' 0 'Đang đóng ứng dụng để bắt đầu cài đặt…' -Force
    [IO.File]::WriteAllText((Join-Path $work 'ready'), 'ready')
    $deadline = [DateTime]::UtcNow.AddSeconds(60)
    while (Get-Process -Id $config.pid -ErrorAction SilentlyContinue) {
        if ([DateTime]::UtcNow -gt $deadline) { throw 'Ứng dụng chưa thoát. Hãy đóng ứng dụng và thử lại.' }
        if ($script:form) { [Windows.Forms.Application]::DoEvents() }
        Start-Sleep -Milliseconds 100
    }
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    New-Item -ItemType Directory -Path $staging, $backup -Force | Out-Null
    $stageRoot = [IO.Path]::GetFullPath($staging).TrimEnd('\') + '\'
    $archive = [IO.Compression.ZipFile]::OpenRead($config.packagePath)
    try {
        $prefix = if ($config.portable) { 'portable/' } else { 'app/' }
        $entries = @($archive.Entries | Where-Object { $_.Name -and $_.FullName.Replace('\', '/').StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase) })
        [long]$total = ($entries | Measure-Object -Property Length -Sum).Sum
        [long]$extracted = 0
        Set-UpdateProgress 'extracting' 5 'Đang giải nén gói cập nhật…' -Force
        foreach ($entry in $archive.Entries) {
            $destination = [IO.Path]::GetFullPath((Join-Path $staging $entry.FullName))
            if (-not $destination.StartsWith($stageRoot, [StringComparison]::OrdinalIgnoreCase)) { throw 'Gói cập nhật chứa đường dẫn không hợp lệ.' }
        }
        foreach ($entry in $entries) {
            $destination = [IO.Path]::GetFullPath((Join-Path $staging $entry.FullName))
            New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
            $inputStream = $entry.Open()
            try {
                $outputStream = [IO.File]::Open($destination, [IO.FileMode]::CreateNew)
                try { Copy-UpdateStream $inputStream $outputStream 'extracting' 5 50 $extracted $total 'Đang giải nén gói cập nhật…' }
                finally { $outputStream.Dispose() }
            } finally { $inputStream.Dispose() }
            $extracted += $entry.Length
        }
    } finally { $archive.Dispose() }
    if ($config.portable) {
        $sourceRoot = Join-Path $staging 'portable'
        $source = Join-Path $sourceRoot 'YTP.exe'
        if (-not (Test-Path -LiteralPath $source -PathType Leaf)) { throw 'Gói cập nhật thiếu portable/YTP.exe.' }
        $files = @(Get-Item -LiteralPath $source)
    } else {
        $sourceRoot = Join-Path $staging 'app'
        if (-not (Test-Path -LiteralPath (Join-Path $sourceRoot (Split-Path -Leaf $targetExe)) -PathType Leaf)) { throw 'Gói cập nhật thiếu file chạy ứng dụng.' }
        $files = @(Get-ChildItem -LiteralPath $sourceRoot -File -Recurse)
    }
    [long]$total = ($files | Measure-Object -Property Length -Sum).Sum
    [long]$written = 0
    Set-UpdateProgress 'installing' 55 'Đang cài đặt các file ứng dụng…' -Force
    foreach ($file in $files) {
        $relative = $file.FullName.Substring($sourceRoot.Length + 1)
        if ($config.portable) { $relative = Split-Path -Leaf $targetExe }
        $destination = Join-Path $targetRoot $relative
        if ($config.userDataPath) {
            $profileRoot = [IO.Path]::GetFullPath($config.userDataPath).TrimEnd('\') + '\'
            if ([IO.Path]::GetFullPath($destination).StartsWith($profileRoot, [StringComparison]::OrdinalIgnoreCase)) { throw 'Gói cập nhật không được ghi vào thư mục dữ liệu người dùng.' }
        }
        $saved = Join-Path $backup $relative
        New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
        if (Test-Path -LiteralPath $destination) {
            # The portable launcher can hold the executable briefly after Electron exits.
            $unlockDeadline = [DateTime]::UtcNow.AddSeconds(30)
            while ($true) {
                try {
                    $lockProbe = [IO.File]::Open($destination, [IO.FileMode]::Open, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None)
                    $lockProbe.Dispose()
                    break
                } catch [IO.IOException] {
                    if ([DateTime]::UtcNow -gt $unlockDeadline) { throw }
                    Set-UpdateProgress 'installing' (55 + 40 * $written / [Math]::Max(1, $total)) 'Đang chờ ứng dụng đóng các file cần cập nhật…'
                    Start-Sleep -Milliseconds 100
                }
            }
            New-Item -ItemType Directory -Path (Split-Path -Parent $saved) -Force | Out-Null
            Copy-Item -LiteralPath $destination -Destination $saved -Force
        }
        $copied.Add($relative)
        $inputStream = [IO.File]::OpenRead($file.FullName)
        try {
            $outputStream = [IO.File]::Open($destination, [IO.FileMode]::Create)
            try { Copy-UpdateStream $inputStream $outputStream 'installing' 55 40 $written $total 'Đang cài đặt các file ứng dụng…' }
            finally { $outputStream.Dispose() }
        } finally { $inputStream.Dispose() }
        $written += $file.Length
    }
    Set-UpdateProgress 'restarting' 98 'Cài đặt xong. Đang mở lại ứng dụng…' -Force
    $windowStyle = if ($showProgress) { 'Normal' } else { 'Hidden' }
    $startParameters = @{ FilePath = $targetExe; WorkingDirectory = $targetRoot; WindowStyle = $windowStyle; ErrorAction = 'Stop' }
    if ($config.userDataPath) { $startParameters.ArgumentList = "--ytp-user-data=`"$($config.userDataPath)`"" }
    Start-Process @startParameters
    Set-UpdateProgress 'complete' 100 'Cập nhật thành công. Đã mở lại ứng dụng.' -Force
    if ($script:form) { Start-Sleep -Milliseconds 500 }
} catch {
    $failure = $_.Exception.Message
    Set-UpdateProgress 'rollback' 0 'Cài đặt thất bại. Đang khôi phục phiên bản cũ…' -Force
    for ($i = $copied.Count - 1; $i -ge 0; $i--) {
        $destination = Join-Path $targetRoot $copied[$i]
        $saved = Join-Path $backup $copied[$i]
        try {
            if (Test-Path -LiteralPath $saved) { Copy-Item -LiteralPath $saved -Destination $destination -Force }
            elseif (Test-Path -LiteralPath $destination) { Remove-Item -LiteralPath $destination -Force }
        } catch { $failure += "`nKhôi phục thất bại: $($_.Exception.Message)" }
    }
    [IO.File]::WriteAllText((Join-Path $work 'error.txt'), $failure, [Text.UTF8Encoding]::new($false))
    Set-UpdateProgress 'error' 0 $failure -Force
    if ($showProgress) {
        Add-Type -AssemblyName System.Windows.Forms
        [Windows.Forms.MessageBox]::Show($script:form, "$failure`nChi tiết: $work", 'Cập nhật Yêu Từ Pé thất bại') | Out-Null
    }
    exit 1
} finally {
    if ($script:form) {
        $script:allowClose = $true
        $script:form.Close()
        $script:form.Dispose()
    }
}
