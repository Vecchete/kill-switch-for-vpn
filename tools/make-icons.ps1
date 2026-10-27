# Renders the extension icons (16, 32, 48 and 128 px) and the Microsoft Edge
# Add-ons store images (300 px logo, 440x280 small promotional tile) with
# System.Drawing. Windows PowerShell 5.1 or PowerShell 7 on Windows.
#
#   powershell -NoProfile -ExecutionPolicy Bypass -File tools/make-icons.ps1

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$blue = [System.Drawing.Color]::FromArgb(255, 11, 87, 208)
$deepBlue = [System.Drawing.Color]::FromArgb(255, 6, 46, 115)
$white = [System.Drawing.Color]::White

function New-Point([double]$x, [double]$y) {
    return New-Object System.Drawing.PointF([single]$x, [single]$y)
}

function Add-Shield($graphics, [double]$x, [double]$y, [double]$size, $fill, $symbol) {
    $w = $size * 0.86
    $h = $size
    $left = $x + ($size - $w) / 2
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $path.AddLine((New-Point ($left + $w * 0.5) $y), (New-Point ($left + $w) ($y + $h * 0.15)))
    $path.AddLine((New-Point ($left + $w) ($y + $h * 0.15)), (New-Point ($left + $w) ($y + $h * 0.47)))
    $path.AddBezier((New-Point ($left + $w) ($y + $h * 0.47)), (New-Point ($left + $w) ($y + $h * 0.76)),
        (New-Point ($left + $w * 0.76) ($y + $h * 0.92)), (New-Point ($left + $w * 0.5) ($y + $h)))
    $path.AddBezier((New-Point ($left + $w * 0.5) ($y + $h)), (New-Point ($left + $w * 0.24) ($y + $h * 0.92)),
        (New-Point $left ($y + $h * 0.76)), (New-Point $left ($y + $h * 0.47)))
    $path.AddLine((New-Point $left ($y + $h * 0.47)), (New-Point $left ($y + $h * 0.15)))
    $path.CloseFigure()
    $brush = New-Object System.Drawing.SolidBrush($fill)
    $graphics.FillPath($brush, $path)
    $brush.Dispose()
    $path.Dispose()

    # Power symbol: an open ring with a bar through the gap.
    $cx = $left + $w * 0.5
    $cy = $y + $h * 0.5
    $r = $size * 0.2
    $pen = New-Object System.Drawing.Pen($symbol, [single]([Math]::Max(1.4, $size * 0.085)))
    $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    $graphics.DrawArc($pen, [single]($cx - $r), [single]($cy - $r), [single]($r * 2), [single]($r * 2), [single]-55, [single]290)
    $graphics.DrawLine($pen, [single]$cx, [single]($cy - $r * 1.3), [single]$cx, [single]($cy - $r * 0.25))
    $pen.Dispose()
}

function New-Canvas([int]$width, [int]$height) {
    $bitmap = New-Object System.Drawing.Bitmap($width, $height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
    $graphics.Clear([System.Drawing.Color]::Transparent)
    return @($bitmap, $graphics)
}

function Save-Canvas($canvas, [string]$path) {
    $canvas[1].Dispose()
    $canvas[0].Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
    $canvas[0].Dispose()
    Write-Output ('wrote {0}' -f $path)
}

$iconDir = Join-Path $root 'extension\icons'
$storeDir = Join-Path $root 'store'
New-Item -ItemType Directory -Force -Path $iconDir, $storeDir | Out-Null

foreach ($size in 16, 32, 48, 128) {
    $canvas = New-Canvas $size $size
    $margin = [Math]::Max(0.5, $size * 0.04)
    Add-Shield $canvas[1] $margin $margin ($size - 2 * $margin) $blue $white
    Save-Canvas $canvas (Join-Path $iconDir ('icon-{0}.png' -f $size))
}

$canvas = New-Canvas 300 300
Add-Shield $canvas[1] 30 30 240 $blue $white
Save-Canvas $canvas (Join-Path $storeDir 'logo-300.png')

$canvas = New-Canvas 440 280
$rect = New-Object System.Drawing.Rectangle(0, 0, 440, 280)
$gradient = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect, $blue, $deepBlue, [single]35)
$canvas[1].FillRectangle($gradient, $rect)
$gradient.Dispose()
Add-Shield $canvas[1] 34 64 152 $white $blue
$titleFont = New-Object System.Drawing.Font('Segoe UI Semibold', [single]27, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
$subtitleFont = New-Object System.Drawing.Font('Segoe UI', [single]17, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
$textBrush = New-Object System.Drawing.SolidBrush($white)
$canvas[1].DrawString('Kill Switch', $titleFont, $textBrush, [single]206, [single]92)
$canvas[1].DrawString('for VPN', $titleFont, $textBrush, [single]206, [single]126)
$canvas[1].DrawString('No VPN, no traffic.', $subtitleFont, $textBrush, [single]208, [single]172)
$titleFont.Dispose()
$subtitleFont.Dispose()
$textBrush.Dispose()
Save-Canvas $canvas (Join-Path $storeDir 'promo-440x280.png')
