param()

$ErrorActionPreference = "Stop"

$repo = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$sandbox = Join-Path $repo "quality\workspace\phase5-worktree"
$results = Join-Path $repo "quality\results"
$patches = Join-Path $repo "quality\patches"
$bugIds = @("002", "004", "005", "006", "007", "008", "009", "010")
$locationPushed = $false

if (-not $sandbox.StartsWith((Join-Path $repo "quality\workspace"), [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "Unsafe sandbox path: $sandbox"
}

New-Item -ItemType Directory -Force -Path (Split-Path $sandbox), $results | Out-Null
if (Test-Path -LiteralPath $sandbox) {
  throw "Phase 5 sandbox already exists: $sandbox"
}

& git -C $repo worktree add --detach $sandbox HEAD | Out-Null
try {
  New-Item -ItemType Junction -Path (Join-Path $sandbox "node_modules") -Target (Join-Path $repo "node_modules") | Out-Null
  $vitest = Join-Path $sandbox "node_modules\.bin\vitest.cmd"
  Push-Location $sandbox
  $locationPushed = $true

  foreach ($numericId in $bugIds) {
    $bugId = "BUG-$numericId"
    $regressionPatch = Join-Path $patches "$bugId-regression-test.patch"
    $fixPatch = Join-Path $patches "$bugId-fix.patch"
    $unguardedPatch = Join-Path $sandbox "$bugId-regression-unguarded.patch"

    $patchText = [IO.File]::ReadAllText($regressionPatch)
    $patchText = $patchText.Replace("it.fails(", "it(").Replace("test.fails(", "test(")
    [IO.File]::WriteAllText($unguardedPatch, $patchText, [Text.UTF8Encoding]::new($false))

    $targetMatch = [regex]::Match($patchText, "diff --git a/[^\r\n]+ b/([^\r\n]+)")
    if (-not $targetMatch.Success) { throw "Cannot locate regression test path for $bugId" }
    $testPath = $targetMatch.Groups[1].Value

    & git -C $sandbox apply --whitespace=error-all $unguardedPatch
    $previousPreference = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    $redOutput = & $vitest run $testPath --reporter=verbose 2>&1 | Out-String
    $redExit = $LASTEXITCODE
    $ErrorActionPreference = $previousPreference
    $redTag = if ($redExit -ne 0) { "RED" } else { "ERROR" }
    $redBody = "$redTag`r`nCommand: vitest run $testPath --reporter=verbose`r`nExit: $redExit`r`n$redOutput"
    [IO.File]::WriteAllText((Join-Path $results "$bugId.red.log"), $redBody, [Text.UTF8Encoding]::new($false))

    if (Test-Path -LiteralPath $fixPatch) {
      & git -C $sandbox apply --whitespace=error-all $fixPatch
      $ErrorActionPreference = "Continue"
      $greenOutput = & $vitest run $testPath --reporter=verbose 2>&1 | Out-String
      $greenExit = $LASTEXITCODE
      $ErrorActionPreference = $previousPreference
      $greenTag = if ($greenExit -eq 0) { "GREEN" } else { "ERROR" }
      $greenBody = "$greenTag`r`nCommand: vitest run $testPath --reporter=verbose`r`nExit: $greenExit`r`n$greenOutput"
      [IO.File]::WriteAllText((Join-Path $results "$bugId.green.log"), $greenBody, [Text.UTF8Encoding]::new($false))
      & git -C $sandbox apply -R $fixPatch
    }

    & git -C $sandbox apply -R $unguardedPatch
    Remove-Item -LiteralPath $unguardedPatch
  }
}
finally {
  if ($locationPushed) { Pop-Location }
  $junction = Join-Path $sandbox "node_modules"
  if (Test-Path -LiteralPath $junction) {
    $junctionItem = Get-Item -LiteralPath $junction
    if ($junctionItem.LinkType -ne "Junction") { throw "Expected node_modules junction" }
    $junctionItem.Delete()
  }
  & git -C $repo worktree remove --force $sandbox | Out-Null
}
