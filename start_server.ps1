# Lightweight .NET HTTP Server in PowerShell for ES Modules hosting
$port = 8080
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")
$listener.Start()
Write-Output "Server running at http://localhost:$port/"
Write-Output "Press Ctrl+C or kill the task to stop the server."

try {
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response
        
        $urlPath = $request.Url.LocalPath.TrimStart('/')
        if ([string]::IsNullOrEmpty($urlPath)) {
            $urlPath = "index.html"
        }
        if ($urlPath -eq "syb-fr8x" -or $urlPath -eq "portal" -or $urlPath -eq "customer-portal") {
            $urlPath = "syb-fr8x.html"
        }
        if ($urlPath -eq "erp") {
            $urlPath = "freight_erp_full.html"
        }
        $filePath = Join-Path (Get-Location) $urlPath
        
        # CORS headers
        $response.Headers.Add("Access-Control-Allow-Origin", "*")
        $response.Headers.Add("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        $response.Headers.Add("Access-Control-Allow-Headers", "Content-Type")

        if ($request.HttpMethod -eq "OPTIONS") {
            $response.StatusCode = 200
            $response.Close()
            continue
        }

        if (Test-Path $filePath -PathType Leaf) {
            $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
            $contentType = "text/plain"
            if ($ext -eq ".html" -or $ext -eq ".htm") { $contentType = "text/html" }
            elseif ($ext -eq ".js") { $contentType = "application/javascript" }
            elseif ($ext -eq ".css") { $contentType = "text/css" }
            elseif ($ext -eq ".json") { $contentType = "application/json" }
            elseif ($ext -eq ".png") { $contentType = "image/png" }
            elseif ($ext -eq ".jpg" -or $ext -eq ".jpeg") { $contentType = "image/jpeg" }
            elseif ($ext -eq ".svg") { $contentType = "image/svg+xml" }
            
            $response.ContentType = $contentType
            $bytes = [System.IO.File]::ReadAllBytes($filePath)
            $response.ContentLength64 = $bytes.Length
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
        } else {
            # Fallback to index.html for SPA router routing (clean Vercel URLs)
            $spaPath = Join-Path (Get-Location) "index.html"
            if (Test-Path $spaPath -PathType Leaf) {
                $response.ContentType = "text/html"
                $bytes = [System.IO.File]::ReadAllBytes($spaPath)
                $response.ContentLength64 = $bytes.Length
                $response.OutputStream.Write($bytes, 0, $bytes.Length)
            } else {
                $response.StatusCode = 404
                $response.ContentType = "text/plain"
                $msg = [System.Text.Encoding]::UTF8.GetBytes("404 File Not Found")
                $response.OutputStream.Write($msg, 0, $msg.Length)
            }
        }
        $response.Close()
    }
} catch {
    Write-Error "Server error: $_"
} finally {
    $listener.Stop()
    Write-Output "Server stopped."
}