param(
    [Parameter(Mandatory=$true)][string]$SrcDir,
    [Parameter(Mandatory=$true)][string]$DestZip
)

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

if (Test-Path $DestZip) {
    Remove-Item $DestZip -Force
}

$fullSrc = (Resolve-Path $SrcDir).Path
$archive = [System.IO.Compression.ZipFile]::Open($DestZip, [System.IO.Compression.ZipArchiveMode]::Create)

Get-ChildItem -Path $fullSrc -Recurse -File | ForEach-Object {
    $rel = $_.FullName.Substring($fullSrc.Length).TrimStart('\', '/').Replace('\', '/')
    [void][System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $_.FullName, $rel, [System.IO.Compression.CompressionLevel]::Optimal)
}

$archive.Dispose()
Write-Host "Created archive: $DestZip"
