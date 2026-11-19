Add-Type -AssemblyName System.Drawing

$src = Join-Path $PSScriptRoot 'icon-src.png'
$out = Join-Path $PSScriptRoot 'icon.ico'

$bmp = [System.Drawing.Bitmap]::FromFile($src)
$w = $bmp.Width
$h = $bmp.Height

$rect = New-Object System.Drawing.Rectangle 0, 0, $w, $h
$data = $bmp.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadOnly, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$bytes = [byte[]]::new($data.Stride * $h)
[System.Runtime.InteropServices.Marshal]::Copy($data.Scan0, $bytes, 0, $bytes.Length)
$bmp.UnlockBits($data)

$minX = $w; $minY = $h; $maxX = -1; $maxY = -1
for ($y = 0; $y -lt $h; $y++) {
    $row = $y * $data.Stride
    for ($x = 0; $x -lt $w; $x++) {
        $i = $row + $x * 4
        $b = $bytes[$i]; $g = $bytes[$i + 1]; $r = $bytes[$i + 2]; $a = $bytes[$i + 3]
        if ($a -gt 10 -and ($r -lt 245 -or $g -lt 245 -or $b -lt 245)) {
            if ($x -lt $minX) { $minX = $x }
            if ($y -lt $minY) { $minY = $y }
            if ($x -gt $maxX) { $maxX = $x }
            if ($y -gt $maxY) { $maxY = $y }
        }
    }
}

if ($maxX -lt 0) { throw 'no content pixels found' }

$pad = 2
$minX = [Math]::Max(0, $minX - $pad); $minY = [Math]::Max(0, $minY - $pad)
$maxX = [Math]::Min($w - 1, $maxX + $pad); $maxY = [Math]::Min($h - 1, $maxY + $pad)

$cw = $maxX - $minX + 1
$ch = $maxY - $minY + 1
$cropRect = New-Object System.Drawing.Rectangle $minX, $minY, $cw, $ch
$crop = $bmp.Clone($cropRect, $bmp.PixelFormat)

$side = [Math]::Max($cw, $ch)
$canvas = New-Object System.Drawing.Bitmap $side, $side, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$gfx = [System.Drawing.Graphics]::FromImage($canvas)
$gfx.Clear([System.Drawing.Color]::White)
$gfx.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$gfx.DrawImage($crop, [int](($side - $cw) / 2), [int](($side - $ch) / 2), $cw, $ch)
$gfx.Dispose()

$sizes = @(256, 128, 64, 48, 32, 16)
$pngs = @{}
foreach ($s in $sizes) {
    $resized = New-Object System.Drawing.Bitmap $s, $s, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g2 = [System.Drawing.Graphics]::FromImage($resized)
    $g2.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g2.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g2.DrawImage($canvas, 0, 0, $s, $s)
    $g2.Dispose()

    $ms = New-Object System.IO.MemoryStream
    $resized.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
    $pngs[$s] = $ms.ToArray()
    $ms.Dispose()
    $resized.Dispose()
}

$fs = [System.IO.File]::Create($out)
$bw = New-Object System.IO.BinaryWriter $fs
$bw.Write([UInt16]0)
$bw.Write([UInt16]1)
$bw.Write([UInt16]$sizes.Count)

$offset = 6 + 16 * $sizes.Count
foreach ($s in $sizes) {
    $len = $pngs[$s].Length
    $dim = if ($s -ge 256) { 0 } else { $s }
    $bw.Write([byte]$dim)
    $bw.Write([byte]$dim)
    $bw.Write([byte]0)
    $bw.Write([byte]0)
    $bw.Write([UInt16]1)
    $bw.Write([UInt16]32)
    $bw.Write([UInt32]$len)
    $bw.Write([UInt32]$offset)
    $offset += $len
}
foreach ($s in $sizes) { $bw.Write($pngs[$s]) }

$bw.Flush(); $bw.Close(); $fs.Close()

# 便于肉眼确认裁切效果
$previewSide = 256
$preview = New-Object System.Drawing.Bitmap $previewSide, $previewSide, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$gp = [System.Drawing.Graphics]::FromImage($preview)
$gp.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$gp.DrawImage($canvas, 0, 0, $previewSide, $previewSide)
$gp.Dispose()
$preview.Save((Join-Path $PSScriptRoot 'icon-preview.png'), [System.Drawing.Imaging.ImageFormat]::Png)
$preview.Dispose()

$bmp.Dispose(); $crop.Dispose(); $canvas.Dispose()

Write-Output ("crop {0}x{1} from {2}x{3}; ico written" -f $cw, $ch, $w, $h)
