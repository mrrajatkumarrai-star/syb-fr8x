$content = Get-Content 'c:\Users\RajatKumarRai\Documents\GitHub\syb-fr8x\freight_erp_full.html' -Raw
$scripts = [regex]::Matches($content, '<script[^>]*>(.*?)</script>', [System.Text.RegularExpressions.RegexOptions]::Singleline)

if ($scripts.Count -gt 0) {
    $js = $scripts[0].Groups[1].Value
    $openBraces = 0
    $closeBraces = 0
    $openParens = 0
    $closeParens = 0
    $openBrackets = 0
    $closeBrackets = 0
    
    # We also want to track template string backticks to ensure they are balanced
    $backticks = 0
    $singleQuotes = 0
    $doubleQuotes = 0
    
    $inSingleQuote = $false
    $inDoubleQuote = $false
    $inBacktick = $false
    $inComment = $false
    $inBlockComment = $false
    
    $charArray = $js.ToCharArray()
    for ($i = 0; $i -lt $charArray.Length; $i++) {
        $c = $charArray[$i]
        $next = if ($i + 1 -lt $charArray.Length) { $charArray[$i+1] } else { $null }
        $prev = if ($i -gt 0) { $charArray[$i-1] } else { $null }
        
        # Simple comment / quote skipper to avoid counting inside strings/comments
        if ($inComment) {
            if ($c -eq "`n" -or $c -eq "`r") { $inComment = $false }
            continue
        }
        if ($inBlockComment) {
            if ($c -eq '*' -and $next -eq '/') { $inBlockComment = $false; $i++ }
            continue
        }
        if ($inSingleQuote) {
            if ($c -eq "'" -and $prev -ne '\') { $inSingleQuote = $false }
            continue
        }
        if ($inDoubleQuote) {
            if ($c -eq '"' -and $prev -ne '\') { $inDoubleQuote = $false }
            continue
        }
        if ($inBacktick) {
            if ($c -eq '`' -and $prev -ne '\') { $inBacktick = $false }
            continue
        }
        
        # Check comments
        if ($c -eq '/' -and $next -eq '/') { $inComment = $true; $i++; continue }
        if ($c -eq '/' -and $next -eq '*') { $inBlockComment = $true; $i++; continue }
        
        # Check quotes
        if ($c -eq "'") { $inSingleQuote = $true; continue }
        if ($c -eq '"') { $inDoubleQuote = $true; continue }
        if ($c -eq '`') { $inBacktick = $true; continue }
        
        # Brackets
        if ($c -eq '{') { $openBraces++ }
        elseif ($c -eq '}') { $closeBraces++ }
        elseif ($c -eq '(') { $openParens++ }
        elseif ($c -eq ')') { $closeParens++ }
        elseif ($c -eq '[') { $openBrackets++ }
        elseif ($c -eq ']') { $closeBrackets++ }
    }
    
    Write-Host "Braces: Open = $openBraces, Close = $closeBraces (Diff: $($openBraces - $closeBraces))"
    Write-Host "Parens: Open = $openParens, Close = $closeParens (Diff: $($openParens - $closeParens))"
    Write-Host "Brackets: Open = $openBrackets, Close = $closeBrackets (Diff: $($openBrackets - $closeBrackets))"
    Write-Host "In single quote: $inSingleQuote"
    Write-Host "In double quote: $inDoubleQuote"
    Write-Host "In backtick (template literal): $inBacktick"
} else {
    Write-Host "No script tag found!"
}
