$ErrorActionPreference = "Stop"

$repo = Split-Path -Parent $PSScriptRoot
$git = "C:\Program Files\Git\cmd\git.exe"
$members = Get-Content (Join-Path $repo "data\members.json") -Raw | ConvertFrom-Json
$house = Get-Content (Join-Path $repo "data\house.json") -Raw | ConvertFrom-Json
$references = @($members | ForEach-Object { $_.image })
$references += @($house.crest_image, $house.hero_image, $house.territory_map)

foreach ($collection in @("territories", "timeline", "newspapers", "gallery", "leaders", "fortifications", "conflicts", "aristocrats", "allies", "vassals")) {
  foreach ($item in @($house.$collection)) {
    $references += $item.image
    $references += @($item.images)
  }
}

$uploads = $references |
  Where-Object { $_ -and $_.StartsWith("uploads/") } |
  Sort-Object -Unique

Push-Location $repo
try {
  foreach ($upload in $uploads) {
    $relativePath = Join-Path "static" $upload
    if (-not (Test-Path $relativePath -PathType Leaf)) {
      throw "Arquivo referenciado nao encontrado: $relativePath"
    }
    & $git add -f -- $relativePath
    if ($LASTEXITCODE -ne 0) {
      throw "Nao foi possivel adicionar: $relativePath"
    }
  }
  Write-Output ("referenced-uploads-staged=" + $uploads.Count)
} finally {
  Pop-Location
}
