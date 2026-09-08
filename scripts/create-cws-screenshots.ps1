Add-Type -AssemblyName System.Drawing

$screenshotsDir = Resolve-Path "screenshots"
$targetWidth = 1280
$targetHeight = 800

$slides = @(
    @{
        Source = "Polyglot dashboard 1.png"
        Output = "cws-1-dashboard-settings"
        Title = "PolyglotGrammar Dashboard & Settings"
        Subtitle = "Full control over real-time proofreading, interface languages, and fallback targets"
        Scale = 0.88
    },
    @{
        Source = "Polyglot dashboard 2.png"
        Output = "cws-2-interactive-playground"
        Title = "Live Proofreading Playground"
        Subtitle = "Instant live grammar checks, domain filters, and custom ignored words list"
        Scale = 0.88
    },
    @{
        Source = "Polyglot example 1.png"
        Output = "cws-3-instant-typo-fixes"
        Title = "Real-Time Typo Detection & 1-Click Fixes"
        Subtitle = "Identifies spelling errors in any web form with instant single or 'Fix All' replacements"
        Scale = 1.25
    },
    @{
        Source = "Polyglot example 2.png"
        Output = "cws-4-synonyms-explorer"
        Title = "Contextual Synonyms Explorer"
        Subtitle = "Rich vocabulary suggestions organized by grammatical parts of speech"
        Scale = 1.15
    },
    @{
        Source = "Polyglot example 3.png"
        Output = "cws-5-multilingual-translation"
        Title = "Instant Multilingual Translation"
        Subtitle = "Translate selected text across 130+ languages powered by Google Translate"
        Scale = 1.25
    }
)

# Helper function to get encoder info for JPEG
function Get-EncoderInfo([string]$mimeType) {
    $encoders = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders()
    foreach ($encoder in $encoders) {
        if ($encoder.MimeType -eq $mimeType) {
            return $encoder
        }
    }
    return $null
}

$jpegEncoder = Get-EncoderInfo "image/jpeg"
$encoderParams = New-Object System.Drawing.Imaging.EncoderParameters(1)
$encoderParams.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, [long]96)

foreach ($slide in $slides) {
    $srcPath = Join-Path $screenshotsDir $slide.Source
    if (-not (Test-Path $srcPath)) {
        Write-Warning "Source image not found: $srcPath"
        continue
    }

    $srcImg = [System.Drawing.Image]::FromFile($srcPath)

    # 1. Create 1280x800 24-bit RGB Bitmap (Strictly NO Alpha Channel)
    $bmp = New-Object System.Drawing.Bitmap($targetWidth, $targetHeight, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit

    # 2. Gradient Background (#0b0f19 to #0d1527 with subtle indigo hue)
    $rect = New-Object System.Drawing.Rectangle(0, 0, $targetWidth, $targetHeight)
    $cTop = [System.Drawing.Color]::FromArgb(11, 15, 25)
    $cBottom = [System.Drawing.Color]::FromArgb(15, 23, 42)
    $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect, $cTop, $cBottom, 45.0)
    $g.FillRectangle($brush, $rect)
    $brush.Dispose()

    # Subtle ambient glow in center
    $glowPath = New-Object System.Drawing.Drawing2D.GraphicsPath
    $glowPath.AddEllipse(140, 60, 1000, 680)
    $glowBrush = New-Object System.Drawing.Drawing2D.PathGradientBrush($glowPath)
    $glowBrush.CenterColor = [System.Drawing.Color]::FromArgb(28, 42, 74)
    $glowBrush.SurroundColors = @([System.Drawing.Color]::FromArgb(11, 15, 25))
    $g.FillPath($glowBrush, $glowPath)
    $glowBrush.Dispose()
    $glowPath.Dispose()

    # 3. Draw Header Title and Subtitle
    $titleFont = New-Object System.Drawing.Font("Segoe UI", 24, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
    $subtitleFont = New-Object System.Drawing.Font("Segoe UI", 14, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)

    $titleBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(248, 250, 252))
    $subtitleBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(148, 163, 184))

    $titleFormat = New-Object System.Drawing.StringFormat
    $titleFormat.Alignment = [System.Drawing.StringAlignment]::Center
    $titleFormat.LineAlignment = [System.Drawing.StringAlignment]::Near

    $titleRect = New-Object System.Drawing.RectangleF(40, 24, 1200, 36)
    $subtitleRect = New-Object System.Drawing.RectangleF(40, 64, 1200, 24)

    $g.DrawString($slide.Title, $titleFont, $titleBrush, $titleRect, $titleFormat)
    $g.DrawString($slide.Subtitle, $subtitleFont, $subtitleBrush, $subtitleRect, $titleFormat)

    $titleFont.Dispose()
    $subtitleFont.Dispose()
    $titleBrush.Dispose()
    $subtitleBrush.Dispose()
    $titleFormat.Dispose()

    # 4. Calculate Scaled Dimensions for UI Image
    $scale = $slide.Scale
    $scaledW = [int]($srcImg.Width * $scale)
    $scaledH = [int]($srcImg.Height * $scale)

    $isBrowserMockup = ($slide.Source -like "*example*")
    $titleBarH = if ($isBrowserMockup) { 36 } else { 0 }

    # Max available area below header (Y from 98 to 780 = max 682px)
    $availH = 670
    if (($scaledH + $titleBarH) > $availH) {
        $fitRatio = $availH / ($scaledH + $titleBarH)
        $scaledW = [int]($scaledW * $fitRatio)
        $scaledH = [int]($scaledH * $fitRatio)
    }

    $cardW = $scaledW
    $cardH = $scaledH + $titleBarH
    $cardX = [int](($targetWidth - $cardW) / 2)
    $cardY = [int](102 + ($availH - $cardH) / 2)

    # Multi-layer soft shadow
    for ($i = 6; $i -ge 1; $i--) {
        $alpha = [int](18 / $i)
        $sBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb($alpha, 0, 0, 0))
        $sRect = [System.Drawing.Rectangle]::new($cardX - $i * 3, $cardY - $i * 2 + 4, $cardW + $i * 6, $cardH + $i * 4)
        $g.FillRectangle($sBrush, $sRect)
        $sBrush.Dispose()
    }

    if ($isBrowserMockup) {
        # Browser mockup window header
        $tbRect = [System.Drawing.Rectangle]::new($cardX, $cardY, $cardW, $titleBarH)
        $tbBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(24, 30, 42))
        $g.FillRectangle($tbBrush, $tbRect)
        $tbBrush.Dispose()

        # Traffic light buttons (close, min, max)
        $redBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 95, 87))
        $yellowBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(254, 188, 46))
        $greenBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(40, 200, 64))

        $dotY = $cardY + 13
        $g.FillEllipse($redBrush, $cardX + 16, $dotY, 10, 10)
        $g.FillEllipse($yellowBrush, $cardX + 32, $dotY, 10, 10)
        $g.FillEllipse($greenBrush, $cardX + 48, $dotY, 10, 10)

        $redBrush.Dispose()
        $yellowBrush.Dispose()
        $greenBrush.Dispose()

        # Mock address bar in center
        $urlW = [int]($cardW * 0.5)
        $urlX = $cardX + [int](($cardW - $urlW) / 2)
        $urlRect = [System.Drawing.Rectangle]::new($urlX, $cardY + 7, $urlW, 22)
        $urlBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(15, 20, 28))
        $g.FillRectangle($urlBrush, $urlRect)
        $urlBrush.Dispose()

        $urlPen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(45, 55, 72), 1)
        $g.DrawRectangle($urlPen, $urlRect)
        $urlPen.Dispose()

        # URL text
        $urlFont = [System.Drawing.Font]::new("Segoe UI", 10, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
        $urlTextBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(148, 163, 184))
        $urlFormat = [System.Drawing.StringFormat]::new()
        $urlFormat.Alignment = [System.Drawing.StringAlignment]::Center
        $urlFormat.LineAlignment = [System.Drawing.StringAlignment]::Center
        $urlTextRect = [System.Drawing.RectangleF]::new($urlX, $cardY + 7, $urlW, 22)
        $g.DrawString("https://web.example.com - Form Input", $urlFont, $urlTextBrush, $urlTextRect, $urlFormat)

        $urlFont.Dispose()
        $urlTextBrush.Dispose()
        $urlFormat.Dispose()

        # Draw Screenshot inside browser content area
        $contentY = $cardY + $titleBarH
        $destRect = [System.Drawing.Rectangle]::new($cardX, $contentY, $cardW, $scaledH)
        $g.DrawImage($srcImg, $destRect, 0, 0, $srcImg.Width, $srcImg.Height, [System.Drawing.GraphicsUnit]::Pixel)

        # Draw Outer border around full browser mockup
        $borderPen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(60, 255, 255, 255), 1)
        $outerRect = [System.Drawing.Rectangle]::new($cardX, $cardY, $cardW, $cardH)
        $g.DrawRectangle($borderPen, $outerRect)
        $borderPen.Dispose()
    } else {
        # Standalone Dashboard popup card
        $destRect = [System.Drawing.Rectangle]::new($cardX, $cardY, $cardW, $cardH)
        $g.DrawImage($srcImg, $destRect, 0, 0, $srcImg.Width, $srcImg.Height, [System.Drawing.GraphicsUnit]::Pixel)

        # Draw Crisp Outer Border around the UI card
        $borderPen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(70, 255, 255, 255), 1)
        $g.DrawRectangle($borderPen, $destRect)
        $borderPen.Dispose()
    }

    # 5. Save Output as JPEG (Strictly 24-bit, zero alpha)
    $outJpg = Join-Path $screenshotsDir ($slide.Output + ".jpg")
    $bmp.Save($outJpg, $jpegEncoder, $encoderParams)

    # Also save as 24-bit PNG
    $outPng = Join-Path $screenshotsDir ($slide.Output + ".png")
    $bmp.Save($outPng, [System.Drawing.Imaging.ImageFormat]::Png)

    Write-Host "Generated 1280x800 screenshot: $outJpg ($($bmp.Width)x$($bmp.Height), $($bmp.PixelFormat))"

    $g.Dispose()
    $bmp.Dispose()
    $srcImg.Dispose()
}

Write-Host "Done! All 5 Chrome Web Store screenshots generated successfully."
